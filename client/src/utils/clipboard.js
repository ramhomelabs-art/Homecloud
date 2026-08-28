export const copyTextToClipboard = async (text) => {
    const fallbackCopy = (t) => {
        const textArea = document.createElement("textarea");
        textArea.value = t;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
        } catch (err) {
            document.body.removeChild(textArea);
            return false;
        }
    };

    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            return fallbackCopy(text);
        }
    } else {
        return fallbackCopy(text);
    }
};
