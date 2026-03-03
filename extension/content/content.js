function extractFormFields() {
    const fields = [];
    const inputs = document.querySelectorAll("input, select, textarea");
    inputs.forEach((el, index) => {
        // Ignore hidden or completely useless fields
        if (el.type === 'hidden' || !isElementVisible(el)) return;

        // Ignore button type inputs
        if (['submit', 'button', 'image', 'reset'].includes(el.type)) return;

        // Ignore checkbox and radio wrappers for a moment if label parsing is bad
        // Let's refine label logic.
        const label = findLabelForElement(el);
        fields.push({
            index: index,
            tag: el.tagName.toLowerCase(),
            type: el.type || "text",
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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "EXTRACT_FIELDS") {
        sendResponse({ fields: extractFormFields() });
    }
    if (msg.type === "FILL_FIELD") {
        const el = document.querySelector(msg.selector);
        if (el) {
            el.focus();
            el.click(); // good for selecting React fields

            // clear out existing
            el.value = "";

            // more robust React/Angular setting
            document.execCommand("insertText", false, msg.value);

            // standard DOM dispatches
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new Event("blur", { bubbles: true }));

            // Add visual Green Flash
            const oldBorder = el.style.border;
            el.style.border = "3px solid #a6e3a1";
            setTimeout(() => { el.style.border = oldBorder; }, 700);

            sendResponse({ success: true });
        } else {
            // Also try finding by name or placeholder as fallback if selector changed dynamically
            const fallbackTypes = Array.from(document.querySelectorAll("input, textarea, select"));
            const fbEl = fallbackTypes.find(e => (e.name && e.name === msg.name) || (e.placeholder && e.placeholder.includes(msg.label)));
            if (fbEl) {
                fbEl.focus();
                fbEl.value = msg.value;
                fbEl.dispatchEvent(new Event("input", { bubbles: true }));
                fbEl.dispatchEvent(new Event("change", { bubbles: true }));
                sendResponse({ success: true, remark: "Fallback success" });
            } else {
                sendResponse({ success: false, error: "Element not found" });
            }
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
    }
    return true;
});
