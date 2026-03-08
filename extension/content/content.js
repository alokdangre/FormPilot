const EXCLUDED_INPUT_TYPES = new Set([
    "hidden",
    "submit",
    "button",
    "image",
    "reset",
]);

const EXTRACTABLE_ROLES = new Set([
    "textbox",
    "searchbox",
    "combobox",
    "listbox",
    "checkbox",
    "radio",
    "switch",
    "spinbutton",
]);

const TRUTHY_VALUES = new Set(["true", "yes", "1", "on", "checked"]);
const FALSY_VALUES = new Set(["false", "no", "0", "off", "unchecked"]);
const BOOLEAN_ALIASES = new Map([
    ["true", ["true", "yes", "y", "1", "on", "checked"]],
    ["false", ["false", "no", "n", "0", "off", "unchecked"]],
]);
const BOOLEAN_TRUE_PHRASES = [
    "i do",
    "yes i do",
    "i have",
    "already have",
    "i already have",
    "yep",
    "yeah",
    "sure",
    "affirmative",
];
const BOOLEAN_FALSE_PHRASES = [
    "i don't",
    "i dont",
    "do not",
    "don't",
    "dont",
    "i do not",
    "i do n't",
    "nope",
    "nah",
    "not really",
    "have not",
    "haven't",
];

// Track which DOM elements have been filled in this session.
const _filledElements = new Set();
let _formPilotElementCounter = 0;

function extractFormFields() {
    const fields = [];
    const radioGroups = new Map();
    let outputIndex = 0;

    for (const el of collectFormControls(document)) {
        const descriptor = buildFieldDescriptor(el, outputIndex);
        if (!descriptor) continue;

        if (descriptor.type === "radio" && descriptor.group_key) {
            if (!radioGroups.has(descriptor.group_key)) {
                radioGroups.set(descriptor.group_key, {
                    first: descriptor,
                    elements: [],
                    options: [],
                });
            }

            const group = radioGroups.get(descriptor.group_key);
            group.elements.push(el);
            if (descriptor.option_text) {
                group.options.push({
                    value: descriptor.option_value || descriptor.option_text,
                    text: descriptor.option_text,
                });
            }
            continue;
        }

        descriptor.index = outputIndex++;
        fields.push(stripInternalFieldProps(descriptor));
    }

    for (const group of radioGroups.values()) {
        const grouped = buildRadioGroupField(group.first, group.options, outputIndex++);
        fields.push(stripInternalFieldProps(grouped));
    }

    return fields;
}

function collectFormControls(root) {
    const controls = [];
    const seen = new Set();

    for (const searchRoot of collectSearchRoots(root)) {
        const scope = searchRoot.nodeType === Node.DOCUMENT_NODE
            ? searchRoot.documentElement
            : searchRoot;

        if (!scope) continue;

        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT);
        let current = scope;

        while (current) {
            if (isPotentialFormControl(current) && !seen.has(current)) {
                seen.add(current);
                controls.push(current);
            }
            current = walker.nextNode();
        }
    }

    return controls;
}

function collectSearchRoots(root, roots = [], seen = new Set()) {
    if (!root || seen.has(root)) return roots;
    seen.add(root);
    roots.push(root);

    const scope = root.nodeType === Node.DOCUMENT_NODE ? root.documentElement : root;
    if (!scope) return roots;

    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT);
    let current = scope;

    while (current) {
        const shadowRoot = getShadowRoot(current);
        if (shadowRoot) {
            collectSearchRoots(shadowRoot, roots, seen);
        }
        current = walker.nextNode();
    }

    return roots;
}

function getShadowRoot(el) {
    if (!(el instanceof Element)) return null;
    if (el.shadowRoot) return el.shadowRoot;

    try {
        const maybeRoot = chrome?.dom?.openOrClosedShadowRoot?.(el);
        if (maybeRoot && typeof maybeRoot.then !== "function") {
            return maybeRoot;
        }
    } catch (_) {
        // Closed shadow roots remain inaccessible unless the extension
        // is explicitly allowed to inspect them.
    }

    return null;
}

function isPotentialFormControl(el) {
    if (!(el instanceof Element)) return false;

    const tag = el.tagName.toLowerCase();
    const role = normalizeToken(el.getAttribute("role"));

    if (tag === "input") {
        return !EXCLUDED_INPUT_TYPES.has((el.type || "text").toLowerCase());
    }

    if (tag === "select" || tag === "textarea") {
        return true;
    }

    if (isContentEditableField(el)) {
        return true;
    }

    if (EXTRACTABLE_ROLES.has(role)) {
        return true;
    }

    return tag.includes("-") && (
        !!el.getAttribute("name") ||
        !!el.getAttribute("form") ||
        !!el.getAttribute("role") ||
        !!el.getAttribute("aria-label") ||
        !!el.getAttribute("aria-labelledby")
    );
}

function isContentEditableField(el) {
    if (!(el instanceof HTMLElement) || !el.isContentEditable) return false;
    if (el.getAttribute("contenteditable") === "false") return false;

    const parent = el.parentElement;
    return !parent || !parent.isContentEditable || el.hasAttribute("contenteditable");
}

function isElementVisible(el) {
    if (!(el instanceof Element)) return false;
    if (el.hidden) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;

    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return false;
    }

    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function buildFieldDescriptor(el, index) {
    if (!isElementVisible(el)) return null;

    const fieldType = inferFieldType(el);
    if (!fieldType) return null;

    const labelData = fieldType === "radio"
        ? findRadioDescriptorLabel(el)
        : findLabelData(el);

    const formpilotId = ensureFormPilotId(el);
    const role = normalizeToken(el.getAttribute("role"));
    const descriptor = {
        index,
        tag: el.tagName.toLowerCase(),
        type: fieldType,
        role,
        name: el.getAttribute("name") || "",
        id: el.id || "",
        label: labelData.text,
        label_source: labelData.source,
        accessible_label: findAccessibleLabel(el) || labelData.text,
        placeholder: getPlaceholderText(el),
        value: getControlValue(el),
        required: isRequiredControl(el),
        disabled: isDisabledControl(el),
        readonly: isReadOnlyControl(el),
        multiple: !!el.multiple || el.getAttribute("aria-multiselectable") === "true",
        options: extractOptionsForElement(el),
        autocomplete: getAutocompleteToken(el),
        input_mode: el.inputMode || el.getAttribute("inputmode") || "",
        semantic_type: inferSemanticType(el, labelData.text),
        boundingBox: serializeRect(el.getBoundingClientRect()),
        visible: true,
        selector: `[data-formpilot-id="${formpilotId}"]`,
        formpilot_id: formpilotId,
        form_id: el.form?.id || el.getAttribute("form") || "",
    };

    if (fieldType === "radio") {
        descriptor.group_key = getRadioGroupKey(el);
        descriptor.option_text = getRadioOptionLabel(el);
        descriptor.option_value = el.value || descriptor.option_text || "";
    }

    return descriptor;
}

function stripInternalFieldProps(field) {
    const clean = { ...field };
    delete clean.group_key;
    delete clean.option_text;
    delete clean.option_value;
    return clean;
}

function buildRadioGroupField(first, options, index) {
    const dedupedOptions = dedupeOptions(options);
    return {
        ...first,
        index,
        value: getRadioGroupValue(first.selector, first.name),
        options: dedupedOptions,
    };
}

function getRadioGroupValue(selector, name) {
    const radio = findFieldElement(selector, "", name, "radio");
    if (!radio) return "";
    const checked = getRadioGroupControls(radio).find((candidate) => isCheckedControl(candidate));
    if (!checked) return "";
    return getRadioOptionLabel(checked) || checked.value || "";
}

function dedupeOptions(options) {
    const seen = new Set();
    const result = [];

    for (const option of options) {
        const text = normalizeText(option?.text || "");
        const value = normalizeText(option?.value || text);
        const key = `${value}::${text}`;
        if (!text || seen.has(key)) continue;
        seen.add(key);
        result.push({ value, text });
    }

    return result;
}

function inferFieldType(el) {
    const tag = el.tagName.toLowerCase();
    const role = normalizeToken(el.getAttribute("role"));

    if (tag === "select") return el.multiple ? "multiselect" : "select";
    if (tag === "textarea") return "textarea";
    if (isContentEditableField(el)) return "textarea";

    if (tag === "input") {
        const nativeType = (el.type || "text").toLowerCase();
        if (EXCLUDED_INPUT_TYPES.has(nativeType)) return null;
        return nativeType || "text";
    }

    if (role === "textbox" || role === "searchbox") {
        return el.getAttribute("aria-multiline") === "true" ? "textarea" : "text";
    }
    if (role === "combobox") return "combobox";
    if (role === "listbox") return "select";
    if (role === "checkbox" || role === "switch") return "checkbox";
    if (role === "radio") return "radio";
    if (role === "spinbutton") return "number";

    if (tag.includes("-")) {
        if (el.getAttribute("aria-haspopup") === "listbox") return "combobox";
        if (el.hasAttribute("contenteditable")) return "textarea";
        return "text";
    }

    return null;
}

function inferSemanticType(el, label) {
    const autocomplete = getAutocompleteToken(el);
    if (autocomplete) return autocomplete;

    const fieldType = inferFieldType(el);
    if (fieldType && fieldType !== "text") return fieldType;

    const inputMode = normalizeToken(el.inputMode || el.getAttribute("inputmode"));
    if (inputMode) return inputMode;

    const haystack = [
        label,
        el.getAttribute("name"),
        el.id,
        getPlaceholderText(el),
    ].map((value) => normalizeText(value).toLowerCase()).join(" ");

    if (haystack.includes("email")) return "email";
    if (haystack.includes("phone") || haystack.includes("mobile") || haystack.includes("telephone")) return "tel";
    if (haystack.includes("country")) return "country";
    if (haystack.includes("city")) return "city";
    if (haystack.includes("state") || haystack.includes("province")) return "state";
    if (haystack.includes("address")) return "street-address";
    if (haystack.includes("zip") || haystack.includes("postal")) return "postal-code";
    if (haystack.includes("first name")) return "given-name";
    if (haystack.includes("last name")) return "family-name";
    if (haystack.includes("full name")) return "name";
    if (haystack.includes("company") || haystack.includes("organization")) return "organization";
    if (haystack.includes("url") || haystack.includes("website")) return "url";
    if (haystack.includes("date")) return "date";

    return "text";
}

function getAutocompleteToken(el) {
    const raw = normalizeText(el.getAttribute("autocomplete") || "");
    if (!raw) return "";

    const tokens = raw.split(/\s+/).filter(Boolean);
    return tokens[tokens.length - 1] || "";
}

function getPlaceholderText(el) {
    return normalizeText(
        el.getAttribute("placeholder") ||
        el.getAttribute("data-placeholder") ||
        ""
    );
}

function getControlValue(el) {
    const role = normalizeToken(el.getAttribute("role"));

    if (el.tagName === "SELECT") {
        const selected = Array.from(el.selectedOptions || []);
        return selected.map((option) => option.text || option.value).join(", ");
    }

    if (el.type === "checkbox" || role === "checkbox" || role === "switch") {
        return isCheckedControl(el) ? (el.value || "true") : "";
    }

    if (el.type === "radio" || role === "radio") {
        return isCheckedControl(el) ? (getRadioOptionLabel(el) || el.value) : "";
    }

    if ("value" in el && typeof el.value === "string") {
        return el.value;
    }

    if (isContentEditableField(el)) {
        return normalizeText(el.innerText || el.textContent || "");
    }

    if (role === "combobox" || role === "listbox" || role === "textbox") {
        return normalizeText(el.innerText || el.textContent || "");
    }

    return "";
}

function extractOptionsForElement(el) {
    if (el.tagName === "SELECT") {
        return Array.from(el.options || []).map((option) => ({
            value: option.value,
            text: normalizeText(option.text || option.label || option.value),
        }));
    }

    if (el.type === "radio") {
        return [];
    }

    if (el.tagName === "INPUT" && el.list) {
        return Array.from(el.list.options || []).map((option) => ({
            value: option.value,
            text: normalizeText(option.label || option.value),
        }));
    }

    const role = normalizeToken(el.getAttribute("role"));
    if (role === "combobox" || role === "listbox") {
        return extractAriaOptions(el);
    }

    return [];
}

function extractAriaOptions(el) {
    const roots = [];
    const controlsId = normalizeText(el.getAttribute("aria-controls"));
    const ownsId = normalizeText(el.getAttribute("aria-owns"));

    if (controlsId) roots.push(findElementById(el, controlsId));
    if (ownsId) roots.push(findElementById(el, ownsId));
    roots.push(el);

    const options = [];
    for (const root of roots.filter(Boolean)) {
        for (const option of root.querySelectorAll('[role="option"]')) {
            options.push({
                value: normalizeText(option.getAttribute("data-value") || option.getAttribute("value") || option.innerText || option.textContent || ""),
                text: normalizeText(option.innerText || option.textContent || option.getAttribute("aria-label") || ""),
            });
        }
    }

    return dedupeOptions(options);
}

function findLabelData(el) {
    const candidates = [
        getLabelsApiText(el, "labels-api"),
        getExplicitLabelText(el, "label-for"),
        getWrapperLabelText(el, "label-wrapper"),
        getFieldsetLegendText(el, "fieldset-legend"),
        getAriaLabelledByText(el, "aria-labelledby"),
        getAriaLabelText(el, "aria-label"),
        getNearbyQuestionText(el, "nearby-question"),
    ];

    for (const candidate of candidates) {
        if (candidate.text) return candidate;
    }

    const placeholder = getPlaceholderText(el);
    if (placeholder) return { text: placeholder, source: "placeholder" };
    if (el.getAttribute("name")) return { text: el.getAttribute("name"), source: "name" };
    if (el.id) return { text: el.id, source: "id" };

    return { text: "Unknown field", source: "unknown" };
}

function findRadioDescriptorLabel(el) {
    const candidates = [
        getGroupContainerLabel(el, "group-container"),
        getFieldsetLegendText(el, "fieldset-legend"),
        getAriaLabelledByText(el, "aria-labelledby"),
        getAriaLabelText(el, "aria-label"),
        getNearbyQuestionText(el, "nearby-question"),
    ];

    for (const candidate of candidates) {
        if (candidate.text) return candidate;
    }

    return findLabelData(el);
}

function getLabelsApiText(el, source) {
    try {
        const texts = Array.from(el.labels || [])
            .map((label) => normalizeText(label.innerText || label.textContent || ""))
            .filter(Boolean);
        if (texts.length) {
            return { text: texts.join(" "), source };
        }
    } catch (_) { }
    return { text: "", source };
}

function getExplicitLabelText(el, source) {
    if (!el.id) return { text: "", source };

    const selector = `label[for="${cssEscape(el.id)}"]`;
    for (const root of getQueryRootsForElement(el)) {
        try {
            const label = root.querySelector(selector);
            if (label) {
                const text = normalizeText(label.innerText || label.textContent || "");
                if (text) return { text, source };
            }
        } catch (_) { }
    }

    return { text: "", source };
}

function getWrapperLabelText(el, source) {
    const label = el.closest("label");
    if (!label) return { text: "", source };

    const text = normalizeText(label.innerText || label.textContent || "");
    return text ? { text, source } : { text: "", source };
}

function getFieldsetLegendText(el, source) {
    const fieldset = el.closest("fieldset");
    if (!fieldset) return { text: "", source };

    const legend = fieldset.querySelector("legend");
    const text = normalizeText(legend?.innerText || legend?.textContent || "");
    return text ? { text, source } : { text: "", source };
}

function getAriaLabelText(el, source) {
    const text = normalizeText(el.getAttribute("aria-label") || "");
    return text ? { text, source } : { text: "", source };
}

function getAriaLabelledByText(el, source) {
    const raw = normalizeText(el.getAttribute("aria-labelledby") || "");
    if (!raw) return { text: "", source };

    const text = raw
        .split(/\s+/)
        .map((id) => findElementById(el, id))
        .filter(Boolean)
        .map((node) => normalizeText(node.innerText || node.textContent || ""))
        .filter(Boolean)
        .join(" ");

    return text ? { text, source } : { text: "", source };
}

function getGroupContainerLabel(el, source) {
    const container = el.closest('[role="radiogroup"], [role="group"], fieldset');
    if (!container) return { text: "", source };

    const labelled = getAriaLabelledByText(container, source);
    if (labelled.text) return labelled;

    const direct = getAriaLabelText(container, source);
    if (direct.text) return direct;

    const legend = container.querySelector("legend");
    const legendText = normalizeText(legend?.innerText || legend?.textContent || "");
    if (legendText) return { text: legendText, source };

    const heading = container.querySelector("label, legend, [role='heading'], h1, h2, h3, h4, h5, h6, .label, .question");
    const headingText = normalizeText(heading?.innerText || heading?.textContent || "");
    return headingText ? { text: headingText, source } : { text: "", source };
}

function getNearbyQuestionText(el, source) {
    let current = el;
    for (let depth = 0; depth < 5 && current; depth += 1) {
        let sibling = current.previousElementSibling;
        while (sibling) {
            const text = extractQuestionLikeText(sibling);
            if (text) return { text, source };
            sibling = sibling.previousElementSibling;
        }

        const parent = current.parentElement;
        if (!parent) break;

        const childText = Array.from(parent.children)
            .filter((child) => child !== current && !child.contains(current))
            .map((child) => extractQuestionLikeText(child))
            .find(Boolean);
        if (childText) return { text: childText, source };

        current = parent;
    }

    return { text: "", source };
}

function extractQuestionLikeText(el) {
    if (!(el instanceof Element)) return "";
    if (el.matches("input, select, textarea, [role='option'], [role='radio'], [role='checkbox']")) {
        return "";
    }

    const text = normalizeText(el.innerText || el.textContent || "");
    if (!text || text.length > 160) return "";
    return text;
}

function findAccessibleLabel(el) {
    return (
        getAriaLabelledByText(el, "aria-labelledby").text ||
        getAriaLabelText(el, "aria-label").text ||
        getLabelsApiText(el, "labels-api").text
    );
}

function getChoiceLabel(el) {
    const candidates = [
        getLabelsApiText(el, "labels-api").text,
        getExplicitLabelText(el, "label-for").text,
        getWrapperLabelText(el, "label-wrapper").text,
        getAriaLabelledByText(el, "aria-labelledby").text,
        getAriaLabelText(el, "aria-label").text,
        getAdjacentOptionText(el),
        normalizeText(el.value || ""),
    ];

    return candidates.find(Boolean) || "";
}

function getRadioOptionLabel(el) {
    const groupLabel = findRadioDescriptorLabel(el).text;
    const candidates = [
        getLabelsApiText(el, "labels-api").text,
        getExplicitLabelText(el, "label-for").text,
        getWrapperLabelText(el, "label-wrapper").text,
        getAriaLabelledByText(el, "aria-labelledby").text,
        getAriaLabelText(el, "aria-label").text,
        getAdjacentOptionText(el),
        normalizeText(el.value || ""),
    ]
        .map((candidate) => sanitizeOptionLabel(candidate, groupLabel))
        .filter(Boolean);

    return candidates.find(Boolean) || normalizeText(el.value || "");
}

function getAdjacentOptionText(el) {
    const siblings = [
        el.nextElementSibling,
        el.previousElementSibling,
    ].filter(Boolean);

    for (const sibling of siblings) {
        const text = normalizeText(sibling.innerText || sibling.textContent || "");
        if (text && text.length <= 60) return text;
    }

    const nodeSiblings = [
        el.nextSibling,
        el.previousSibling,
    ].filter((node) => node && node.nodeType === Node.TEXT_NODE);

    for (const node of nodeSiblings) {
        const text = normalizeText(node.textContent || "");
        if (text && text.length <= 60) return text;
    }

    return "";
}

function sanitizeOptionLabel(text, groupLabel) {
    let normalized = normalizeText(text);
    if (!normalized) return "";

    const normalizedGroup = normalizeText(groupLabel);
    if (normalizedGroup && normalized === normalizedGroup) {
        return "";
    }

    if (normalizedGroup && normalized.startsWith(normalizedGroup)) {
        normalized = normalizeText(normalized.slice(normalizedGroup.length));
    }

    if (!normalized) return "";
    if (normalized.length > 80) return "";
    return normalized;
}

function getRadioGroupKey(el) {
    const groupContainer = el.closest('[role="radiogroup"], fieldset');
    if (groupContainer) {
        return `radio:${ensureFormPilotId(groupContainer)}`;
    }

    if (el.name) return `radio-name:${el.name}`;
    return `radio:${ensureFormPilotId(el)}`;
}

function ensureFormPilotId(el) {
    if (!(el instanceof HTMLElement)) return "";
    if (!el.dataset.formpilotId) {
        _formPilotElementCounter += 1;
        el.dataset.formpilotId = `fp-${_formPilotElementCounter}`;
    }
    return el.dataset.formpilotId;
}

function serializeRect(rect) {
    return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
    };
}

function isRequiredControl(el) {
    return !!el.required ||
        el.getAttribute("aria-required") === "true" ||
        el.hasAttribute("required");
}

function isDisabledControl(el) {
    return !!el.disabled || el.getAttribute("aria-disabled") === "true";
}

function isReadOnlyControl(el) {
    return !!el.readOnly || el.getAttribute("aria-readonly") === "true";
}

function getQueryRootsForElement(el) {
    const roots = [];
    const rootNode = el.getRootNode?.();
    if (rootNode && rootNode.querySelector) roots.push(rootNode);
    if (el.ownerDocument && !roots.includes(el.ownerDocument)) roots.push(el.ownerDocument);
    return roots;
}

function findElementById(el, id) {
    if (!id) return null;

    const escaped = cssEscape(id);
    for (const root of getQueryRootsForElement(el)) {
        try {
            const node = root.querySelector(`#${escaped}`);
            if (node) return node;
        } catch (_) { }
    }

    return null;
}

function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value).replace(/["\\#.:()[\]\s]/g, "\\$&");
}

function normalizeText(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .replace(/\s*\*\s*$/, "")
        .trim();
}

function normalizeToken(value) {
    return normalizeText(value).toLowerCase();
}

function getVisibleControls(includeFilled = true) {
    return collectFormControls(document)
        .filter((el) => isElementVisible(el))
        .filter((el) => includeFilled || !_filledElements.has(el));
}

function getAllFillableControls() {
    return getVisibleControls(false);
}

function findFieldElement(selector, label, name, fieldType) {
    const allInputs = getVisibleControls(true);

    const byStableId = findByStableSelector(allInputs, selector);
    if (byStableId) return byStableId;

    if (fieldType === "radio" && label) {
        const match = findRadioLikeElement(allInputs, label, name);
        if (match) return match;
    }

    if (selector) {
        const match = querySelectorAcrossRoots(selector);
        if (match && !_filledElements.has(match)) return match;
    }

    if (label) {
        const labelLower = label.toLowerCase().trim();
        const byLabel = allInputs.find((input) => {
            const inputLabel = findLabelData(input).text.toLowerCase().trim();
            const accessible = findAccessibleLabel(input).toLowerCase().trim();
            return [inputLabel, accessible].some((candidate) =>
                candidate && (candidate.includes(labelLower) || labelLower.includes(candidate))
            );
        });
        if (byLabel) return byLabel;
    }

    if (name || label) {
        const nameLower = normalizeToken(name);
        const labelLower = normalizeToken(label);
        const byMetadata = allInputs.find((input) => {
            const metadata = [
                input.getAttribute("name"),
                input.id,
                getPlaceholderText(input),
                input.getAttribute("autocomplete"),
                input.getAttribute("aria-label"),
            ].map((value) => normalizeToken(value));

            return metadata.some((candidate) =>
                candidate && (
                    (nameLower && candidate.includes(nameLower)) ||
                    (labelLower && candidate.includes(labelLower))
                )
            );
        });
        if (byMetadata) return byMetadata;
    }

    if (label) {
        return fuzzyMatchByNearbyText(allInputs, label);
    }

    return null;
}

function findByStableSelector(allInputs, selector) {
    const match = /\[data-formpilot-id="([^"]+)"\]/.exec(selector || "");
    if (!match) return null;
    const expectedId = match[1];
    return allInputs.find((el) => el.dataset?.formpilotId === expectedId) || null;
}

function querySelectorAcrossRoots(selector) {
    for (const root of collectSearchRoots(document)) {
        if (!root.querySelector) continue;
        try {
            const el = root.querySelector(selector);
            if (el) return el;
        } catch (_) { }
    }
    return null;
}

function findRadioLikeElement(allInputs, label, name) {
    const labelLower = label.toLowerCase();
    const radios = allInputs.filter((el) => inferFieldType(el) === "radio");

    for (const radio of radios) {
        const container = getRadioGroupContainer(radio) || radio.parentElement;
        const text = normalizeToken(container?.innerText || "");
        if (text && (text.includes(labelLower) || labelLower.includes(text.slice(0, 80)))) {
            return radio;
        }
    }

    if (name) {
        const byName = radios.find((radio) => normalizeToken(radio.getAttribute("name")).includes(normalizeToken(name)));
        if (byName) return byName;
    }

    return null;
}

function fuzzyMatchByNearbyText(allInputs, label) {
    const keywords = label.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
    let bestMatch = null;
    let bestScore = 0;

    for (const input of allInputs) {
        let parent = input.parentElement;
        for (let depth = 0; depth < 4 && parent; depth += 1) {
            const text = normalizeToken(parent.innerText || "");
            const score = keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0);
            if (score > bestScore && score >= Math.ceil(keywords.length * 0.5)) {
                bestScore = score;
                bestMatch = input;
            }
            parent = parent.parentElement;
        }
    }

    return bestMatch;
}

function markElementAsFilled(el) {
    if (el) _filledElements.add(el);
}

function resetFilledTracking() {
    _filledElements.clear();
}

function fillElement(el, value) {
    const desired = String(value ?? "");
    const type = inferFieldType(el);
    const role = normalizeToken(el.getAttribute("role"));

    el.focus();

    if (type === "radio") {
        return fillRadioGroup(el, desired);
    }

    if (type === "checkbox" || role === "switch") {
        return fillBooleanControl(el, desired);
    }

    if (el.tagName === "SELECT") {
        return fillNativeSelect(el, desired);
    }

    if (type === "combobox" || type === "select") {
        return fillCompositeChoice(el, desired);
    }

    if (isContentEditableField(el) || (role === "textbox" && !("value" in el))) {
        fillEditableRegion(el, desired);
        return true;
    }

    el.click();

    if ("value" in el) {
        el.value = "";
        document.execCommand("insertText", false, desired);
        if (el.value !== desired) {
            el.value = desired;
        }
    } else {
        el.textContent = desired;
    }

    dispatchValueEvents(el);
    flashFilledElement(el);
    return true;
}

function getRadioGroupContainer(el) {
    return el.closest('[role="radiogroup"], [role="group"], fieldset');
}

function getRadioGroupControls(el) {
    const groupContainer = getRadioGroupContainer(el);
    if (groupContainer) {
        return collectFormControls(groupContainer)
            .filter((candidate) => inferFieldType(candidate) === "radio")
            .filter((candidate) => isElementVisible(candidate));
    }

    const nativeName = normalizeText(el.getAttribute("name") || el.name || "");
    if (nativeName) {
        return getVisibleControls(true).filter((candidate) =>
            inferFieldType(candidate) === "radio" &&
            normalizeText(candidate.getAttribute("name") || candidate.name || "") === nativeName
        );
    }

    return [el];
}

function fillRadioGroup(el, value) {
    const radios = getRadioGroupControls(el);

    const desired = value.toLowerCase();
    for (const radio of radios) {
        const label = getRadioOptionLabel(radio).toLowerCase();
        const radioValue = normalizeToken(
            radio.value ||
            radio.getAttribute("value") ||
            radio.getAttribute("data-value") ||
            radio.getAttribute("aria-label") ||
            ""
        );
        if (matchesChoiceValue(label, radioValue, desired)) {
            radio.click();
            if ("checked" in radio) {
                radio.checked = true;
            }
            if (radio.getAttribute("role") === "radio") {
                radio.setAttribute("aria-checked", "true");
                for (const sibling of radios) {
                    if (sibling !== radio && sibling.getAttribute("role") === "radio") {
                        sibling.setAttribute("aria-checked", "false");
                    }
                }
            }
            dispatchValueEvents(radio);
            flashFilledElement(radio.closest("label") || radio.parentElement || radio);
            return true;
        }
    }

    return false;
}

function fillBooleanControl(el, value) {
    const normalized = normalizeToken(value);
    const desiredBoolean = canonicalBoolean(normalized);
    if (desiredBoolean === null) {
        return false;
    }

    const wantsChecked = desiredBoolean === "true";
    const checked = isCheckedControl(el);

    if (checked !== wantsChecked) {
        el.click();
        if ("checked" in el) el.checked = wantsChecked;
        if (el.getAttribute("role")) {
            el.setAttribute("aria-checked", String(wantsChecked));
        }
    }

    dispatchValueEvents(el);
    flashFilledElement(el);
    return true;
}

function matchesChoiceValue(label, rawValue, desired) {
    const normalizedDesired = normalizeToken(desired);
    const normalizedLabel = normalizeToken(label);
    const normalizedValue = normalizeToken(rawValue);

    if (!normalizedDesired) return false;

    const desiredBoolean = canonicalBoolean(normalizedDesired);
    if (desiredBoolean !== null) {
        return [normalizedLabel, normalizedValue].some((candidate) => canonicalBoolean(candidate) === desiredBoolean);
    }

    return [normalizedLabel, normalizedValue].some((candidate) =>
        candidate && (
            candidate === normalizedDesired ||
            candidate.includes(normalizedDesired) ||
            normalizedDesired.includes(candidate)
        )
    );
}

function canonicalBoolean(value) {
    const normalized = normalizeToken(value);
    for (const [canonical, aliases] of BOOLEAN_ALIASES.entries()) {
        if (aliases.includes(normalized)) return canonical;
    }

    const tokenText = normalized.replace(/[^a-z0-9'\s]+/g, " ").replace(/\s+/g, " ").trim();
    if (BOOLEAN_FALSE_PHRASES.some((phrase) => tokenText.includes(phrase))) {
        return "false";
    }
    if (BOOLEAN_TRUE_PHRASES.some((phrase) => tokenText.includes(phrase))) {
        return "true";
    }
    return null;
}

function isCheckedControl(el) {
    if ("checked" in el) return !!el.checked;
    return el.getAttribute("aria-checked") === "true";
}

function fillNativeSelect(el, value) {
    const desired = normalizeToken(value);
    const option = Array.from(el.options || []).find((candidate) => {
        const text = normalizeToken(candidate.text);
        const rawValue = normalizeToken(candidate.value);
        return text.includes(desired) || desired.includes(text) || rawValue === desired;
    });

    if (!option) return false;

    el.value = option.value;
    dispatchValueEvents(el);
    flashFilledElement(el);
    return true;
}

function fillCompositeChoice(el, value) {
    el.click();

    const option = findCompositeOption(el, value);
    if (!option) return false;

    option.click();
    dispatchValueEvents(el);
    flashFilledElement(el);
    return true;
}

function findCompositeOption(el, value) {
    const desired = normalizeToken(value);
    const roots = [];
    const controls = normalizeText(el.getAttribute("aria-controls"));
    const owns = normalizeText(el.getAttribute("aria-owns"));

    if (controls) roots.push(findElementById(el, controls));
    if (owns) roots.push(findElementById(el, owns));
    roots.push(document);

    for (const root of roots.filter(Boolean)) {
        const options = root.querySelectorAll
            ? root.querySelectorAll('[role="option"], option')
            : [];
        for (const option of options) {
            const text = normalizeToken(option.innerText || option.textContent || option.label || option.value);
            if (text && (text.includes(desired) || desired.includes(text))) {
                return option;
            }
        }
    }

    return null;
}

function fillEditableRegion(el, value) {
    el.click();
    if (document.activeElement !== el) el.focus();

    if (document.execCommand) {
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, value);
    }

    const currentText = normalizeText(el.innerText || el.textContent || "");
    if (currentText !== value) {
        el.textContent = value;
    }

    dispatchValueEvents(el);
    flashFilledElement(el);
}

function dispatchValueEvents(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
}

function flashFilledElement(el) {
    const target = el instanceof HTMLElement ? el : null;
    if (!target) return;

    const oldBorder = target.style.border;
    const oldOutline = target.style.outline;
    target.style.border = "2px solid #a6e3a1";
    target.style.outline = "2px solid rgba(166, 227, 161, 0.3)";
    setTimeout(() => {
        target.style.border = oldBorder;
        target.style.outline = oldOutline;
    }, 800);
}

function readFilledValue(el, fieldType, selector, name) {
    if (fieldType === "radio") {
        return getRadioGroupValue(selector, name);
    }
    return getControlValue(el);
}

function valuesMatchRequested(actualValue, requestedValue, fieldType) {
    const actual = normalizeText(actualValue);
    const requested = normalizeText(requestedValue);
    if (!requested) return false;

    if (fieldType === "email") {
        return actual.toLowerCase() === requested.toLowerCase();
    }

    if (["radio", "checkbox", "switch", "select", "combobox", "multiselect"].includes(fieldType)) {
        const desiredBoolean = canonicalBoolean(requested);
        const actualBoolean = canonicalBoolean(actual);
        if (desiredBoolean !== null || actualBoolean !== null) {
            return desiredBoolean !== null && desiredBoolean === actualBoolean;
        }
        return matchesChoiceValue(actual, actual, requested);
    }

    return normalizeText(actual) === normalizeText(requested);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "EXTRACT_FIELDS") {
        resetFilledTracking();
        sendResponse({ fields: extractFormFields() });
    }

    if (msg.type === "FILL_FIELD") {
        const el = findFieldElement(msg.selector, msg.label, msg.name, msg.fieldType);

        if (el) {
            const filled = fillElement(el, msg.value);
            if (filled) {
                const actualValue = readFilledValue(el, msg.fieldType, msg.selector, msg.name);
                if (!valuesMatchRequested(actualValue, msg.value, msg.fieldType)) {
                    sendResponse({
                        success: false,
                        actualValue,
                        error: "Requested value did not stick in the DOM",
                    });
                    return true;
                }

                markElementAsFilled(el);
                sendResponse({ success: true, actualValue });
            } else {
                sendResponse({
                    success: false,
                    error: "Unable to match the requested value to a valid control option",
                });
            }
        } else {
            console.warn("[FormPilot] Could not find element for:", msg.label, msg.selector);
            sendResponse({ success: false, error: "Element not found: " + (msg.label || msg.selector) });
        }
    }

    if (msg.type === "CLICK_ELEMENT") {
        const el = querySelectorAcrossRoots(msg.selector);
        if (el) {
            el.click();
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false });
        }
    }

    if (msg.type === "SCROLL_PAGE") {
        window.scrollBy(0, msg.amount || 300);
        sendResponse({ success: true });
        return true;
    }

    return true;
});
