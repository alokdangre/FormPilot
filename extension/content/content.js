function extractFormFields() {
    const fields = [];
    const inputs = document.querySelectorAll("input, select, textarea");
    const radioGroups = {};  // Group radios by name

    inputs.forEach((el, index) => {
        // Ignore hidden or completely useless fields
        if (el.type === 'hidden' || !isElementVisible(el)) return;

        // Ignore button type inputs
        if (['submit', 'button', 'image', 'reset'].includes(el.type)) return;

        // Group radio buttons by name
        if (el.type === 'radio') {
            const groupName = el.name || `radio_${index}`;
            if (!radioGroups[groupName]) {
                radioGroups[groupName] = {
                    elements: [],
                    labels: [],
                    selector: generateUniqueSelector(el),
                    required: el.required || el.getAttribute("aria-required") === "true",
                };
            }
            radioGroups[groupName].elements.push(el);
            const labelText = el.labels?.[0]?.textContent?.trim() ||
                el.value ||
                el.nextSibling?.textContent?.trim() || '';
            if (labelText) radioGroups[groupName].labels.push(labelText);
            return;
        }

        const label = findLabelForElement(el);
        fields.push({
            index: index,
            tag: el.tagName.toLowerCase(),
            type: el.type || (el.tagName === "TEXTAREA" ? "textarea" : "text"),
            name: el.name || "",
            id: el.id || "",
            label: label,
            placeholder: el.placeholder || "",
            value: el.value || "",
            required: el.required || el.getAttribute("aria-required") === "true",
            options: el.tagName === "SELECT"
                ? Array.from(el.options).map(o => ({ value: o.value, text: o.text }))
                : [],
            boundingBox: el.getBoundingClientRect(),
            visible: true,
            selector: generateUniqueSelector(el),
        });
    });

    // Add grouped radio buttons as single fields with options
    for (const [name, group] of Object.entries(radioGroups)) {
        // Find the question/label for the radio group
        const firstEl = group.elements[0];
        let groupLabel = findLabelForElement(firstEl);

        // If no direct label, look for the closest fieldset legend or parent text
        if (!groupLabel || groupLabel === 'Unknown field') {
            const fieldset = firstEl.closest('fieldset');
            if (fieldset) {
                const legend = fieldset.querySelector('legend');
                groupLabel = legend?.textContent?.trim() || '';
            }
            if (!groupLabel) {
                // Check parent containers for question text
                let parent = firstEl.parentElement;
                for (let i = 0; i < 5 && parent; i++) {
                    const textNodes = Array.from(parent.childNodes)
                        .filter(n => n.nodeType === 3 && n.textContent.trim())
                        .map(n => n.textContent.trim());
                    if (textNodes.length) {
                        groupLabel = textNodes[0];
                        break;
                    }
                    const labelEl = parent.querySelector('label, .label, [class*="label"], [class*="question"]');
                    if (labelEl && !labelEl.querySelector('input')) {
                        groupLabel = labelEl.textContent.trim();
                        break;
                    }
                    parent = parent.parentElement;
                }
            }
        }

        fields.push({
            index: fields.length,
            tag: "input",
            type: "radio",
            name: name,
            id: firstEl.id || "",
            label: groupLabel || name,
            placeholder: "",
            value: group.elements.find(e => e.checked)?.value || "",
            required: group.required,
            options: group.labels.map(l => ({ value: l, text: l })),
            boundingBox: firstEl.getBoundingClientRect(),
            visible: true,
            selector: group.selector,
        });
    }

    return fields;
}

function findLabelForElement(el) {
    // 1. Explicit <label for="...">
    if (el.id) {
        const label = document.querySelector(`label[for="${el.id}"]`);
        if (label && label.textContent.trim()) return label.textContent.trim();
    }

    // 2. Implicit <label> wrapper
    const parentLabel = el.closest("label");
    if (parentLabel && parentLabel.textContent.trim()) {
        // Make sure we don't accidentally pull in the input's own text if it's weirdly formatted
        let text = parentLabel.innerText.trim();
        if (text) return text.split("\n")[0].trim();
    }

    // 3. Aria attributes (very common in modern React/Angular/Google Forms)
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
    if (el.getAttribute("aria-labelledby")) {
        const labelledByElement = document.getElementById(el.getAttribute("aria-labelledby"));
        if (labelledByElement) return labelledByElement.textContent.trim();
    }

    // 4. Look at parent structures. Google Forms often wrap the question in a div with role="heading" or similar.
    // We'll walk up a few levels and look for common label-like elements preceeding us.
    let currentParent = el.parentElement;
    for (let i = 0; i < 4; i++) { // Check up to 4 levels up
        if (!currentParent) break;

        // Check for previous siblings of parents that might be headings
        let prev = currentParent.previousElementSibling;
        while (prev) {
            if (['LABEL', 'SPAN', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(prev.tagName)) {
                const text = prev.innerText.trim();
                if (text && text.length < 150) { // arbitrary length to avoid pulling whole paragraphs
                    // Often spans contain " * " for required fields. Clean it up.
                    return text.split("\n").filter(line => line.trim() && line.trim() !== "*")[0].trim();
                }
            }
            prev = prev.previousElementSibling;
        }
        currentParent = currentParent.parentElement;
    }

    return el.placeholder || el.name || el.id || "Unknown field";
}

function generateUniqueSelector(el) {
    if (el.id) return `#${el.id}`;
    if (el.name) return `${el.tagName.toLowerCase()}[name="${el.name}"]`;

    // Generating a hierarchical selector as a fallback
    let path = [];
    let currentEl = el;
    while (currentEl && currentEl.nodeType === Node.ELEMENT_NODE) {
        let selector = currentEl.nodeName.toLowerCase();
        if (currentEl.id) {
            selector += '#' + currentEl.id;
            path.unshift(selector);
            break;
        } else {
            let sibling = currentEl;
            let nth = 1;
            while (sibling = sibling.previousElementSibling) {
                if (sibling.nodeName.toLowerCase() == selector) nth++;
            }
            if (nth != 1) selector += ":nth-of-type(" + nth + ")";
        }
        path.unshift(selector);
        currentEl = currentEl.parentNode;
    }
    return path.join(" > ");
}

function isElementVisible(el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
    );
}

// ═══════════════════════════════════════════════════
// Robust Field Finder — works even without CSS selectors
// Tracks already-filled elements to prevent double-filling
// ═══════════════════════════════════════════════════

// Track which DOM elements have been filled in this session
const _filledElements = new Set();

function findFieldElement(selector, label, name, fieldType) {
    const allInputs = Array.from(document.querySelectorAll("input, textarea, select"))
        .filter(el => isElementVisible(el) && !['submit', 'button', 'image', 'reset', 'hidden'].includes(el.type))
        .filter(el => !_filledElements.has(el));  // Skip already-filled elements

    // Level 0: Special handling for radio buttons
    // Radio group labels are on the parent container, not on individual radios
    if (fieldType === 'radio' && label) {
        const labelLower = label.toLowerCase();
        // Find all radio inputs
        const allRadios = allInputs.filter(el => el.type === 'radio');
        for (const radio of allRadios) {
            // Walk up to find a container that has the question text
            let parent = radio.parentElement;
            for (let i = 0; i < 6 && parent; i++) {
                const text = (parent.innerText || '').toLowerCase();
                if (text.includes(labelLower) || labelLower.includes(text.substring(0, 50))) {
                    return radio; // Return the first radio in the matching group
                }
                parent = parent.parentElement;
            }
        }
        // Also try by name attribute
        if (name) {
            const radio = allRadios.find(r => r.name && r.name.toLowerCase().includes(name.toLowerCase()));
            if (radio) return radio;
        }
    }

    // Level 1: CSS selector (when DOM extraction worked)
    if (selector) {
        try {
            const el = document.querySelector(selector);
            if (el && !_filledElements.has(el)) return el;
        } catch (e) { /* invalid selector */ }
    }

    // Level 2: Match by associated <label> text
    if (label) {
        const labelLower = label.toLowerCase().trim();
        for (const input of allInputs) {
            const inputLabel = findLabelForElement(input).toLowerCase().trim();
            if (inputLabel && (inputLabel.includes(labelLower) || labelLower.includes(inputLabel))) {
                return input;
            }
        }
    }

    // Level 3: Match by aria-label
    if (label) {
        const labelLower = label.toLowerCase();
        const found = allInputs.find(el => {
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            return aria && (aria.includes(labelLower) || labelLower.includes(aria));
        });
        if (found) return found;
    }

    // Level 4: Match by name attribute or placeholder
    if (name || label) {
        const found = allInputs.find(el => {
            if (name && el.name && el.name.toLowerCase().includes(name.toLowerCase())) return true;
            if (label) {
                const ph = (el.placeholder || '').toLowerCase();
                if (ph && ph.includes(label.toLowerCase())) return true;
            }
            return false;
        });
        if (found) return found;
    }

    // Level 5: Fuzzy search — check text near each input
    if (label) {
        const keywords = label.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        let bestMatch = null;
        let bestScore = 0;

        for (const input of allInputs) {
            let parent = input.parentElement;
            for (let i = 0; i < 4 && parent; i++) {
                const text = parent.innerText?.toLowerCase() || '';
                let score = 0;
                for (const kw of keywords) {
                    if (text.includes(kw)) score++;
                }
                if (score > bestScore && score >= Math.ceil(keywords.length * 0.5)) {
                    bestScore = score;
                    bestMatch = input;
                }
                parent = parent.parentElement;
            }
        }
        if (bestMatch) return bestMatch;
    }

    return null;
}

function markElementAsFilled(el) {
    if (el) _filledElements.add(el);
}

// Reset tracking when a new analysis starts
function resetFilledTracking() {
    _filledElements.clear();
}

// ═══════════════════════════════════════════════════
// Robust Element Filler — works across React/Angular/vanilla
// ═══════════════════════════════════════════════════

function fillElement(el, value) {
    el.focus();

    // Handle radio buttons — find the right radio in the group
    if (el.type === 'radio') {
        const radios = el.name
            ? document.querySelectorAll(`input[type="radio"][name="${el.name}"]`)
            : [el];
        for (const radio of radios) {
            const radioLabel = radio.labels?.[0]?.textContent?.trim() ||
                radio.value ||
                radio.nextSibling?.textContent?.trim() || '';
            if (radioLabel.toLowerCase().includes(value.toLowerCase()) ||
                value.toLowerCase().includes(radioLabel.toLowerCase())) {
                radio.click();
                radio.checked = true;
                radio.dispatchEvent(new Event("change", { bubbles: true }));
                // Visual feedback
                const parent = radio.closest('label') || radio.parentElement;
                if (parent) {
                    parent.style.outline = "2px solid #a6e3a1";
                    setTimeout(() => { parent.style.outline = ""; }, 800);
                }
                return;
            }
        }
        // If no match found, just click the first one
        el.click();
        return;
    }

    el.click();

    // Handle select dropdowns
    if (el.tagName === 'SELECT') {
        const option = Array.from(el.options).find(o =>
            o.text.toLowerCase().includes(value.toLowerCase()) ||
            o.value.toLowerCase().includes(value.toLowerCase())
        );
        if (option) {
            el.value = option.value;
        } else {
            el.value = value;
        }
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return;
    }

    // Clear existing value
    el.value = "";

    // Use execCommand for React/Angular compatibility
    document.execCommand("insertText", false, value);

    // Standard DOM event dispatches
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));

    // Visual green flash feedback
    const oldBorder = el.style.border;
    const oldOutline = el.style.outline;
    el.style.border = "2px solid #a6e3a1";
    el.style.outline = "2px solid rgba(166, 227, 161, 0.3)";
    setTimeout(() => {
        el.style.border = oldBorder;
        el.style.outline = oldOutline;
    }, 800);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "EXTRACT_FIELDS") {
        resetFilledTracking();  // New analysis = reset fill tracking
        sendResponse({ fields: extractFormFields() });
    }
    if (msg.type === "FILL_FIELD") {
        // 5-level element finder with filled-element tracking
        const el = findFieldElement(msg.selector, msg.label, msg.name, msg.fieldType);

        if (el) {
            fillElement(el, msg.value);
            markElementAsFilled(el);  // Track this element as filled
            sendResponse({ success: true });
        } else {
            console.warn("[FormPilot] Could not find element for:", msg.label, msg.selector);
            sendResponse({ success: false, error: "Element not found: " + (msg.label || msg.selector) });
        }
    }
    if (msg.type === "CLICK_ELEMENT") {
        const el = document.querySelector(msg.selector);
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

    // Audio recording is now handled by the offscreen document (offscreen/offscreen.js)
    // No mic code needed in the content script anymore.

    return true;
});
