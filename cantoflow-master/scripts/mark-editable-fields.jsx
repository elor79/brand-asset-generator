/**
 * CantoFlow - Mark Editable Fields
 * Adobe InDesign ExtendScript
 *
 * This script helps designers mark which text frames and image frames
 * should be editable in the CantoFlow platform.
 *
 * Usage:
 * 1. Select the text frames or image frames you want to make editable
 * 2. Run this script (File > Scripts > Run Script)
 * 3. Choose the type of editable element
 * 4. The script will tag the elements appropriately
 * 5. Export your document as IDML (File > Export > InDesign Markup)
 * 6. Upload the IDML to CantoFlow
 */

#target indesign

// Main function
function main() {
    // Check if document is open
    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;
    var selection = app.selection;

    // Check if anything is selected
    if (selection.length === 0) {
        alert("Please select one or more text frames or image frames to mark as editable.");
        return;
    }

    // Create dialog
    var dialog = new Window("dialog", "Mark Editable Fields - CantoFlow");
    dialog.alignChildren = "left";

    // Info panel
    var infoGroup = dialog.add("panel", undefined, "Instructions");
    infoGroup.alignChildren = "left";
    infoGroup.add("statictext", undefined, "Selected items: " + selection.length);
    infoGroup.add("statictext", undefined, "Choose the type of editable field:");

    // Radio buttons
    var typeGroup = dialog.add("group");
    typeGroup.alignChildren = "left";
    typeGroup.orientation = "column";

    var textRadio = typeGroup.add("radiobutton", undefined, "Editable Text");
    var imageRadio = typeGroup.add("radiobutton", undefined, "Editable Image");
    var lockedRadio = typeGroup.add("radiobutton", undefined, "Locked (Not Editable)");

    textRadio.value = true; // Default selection

    // Optional: Add field name
    var nameGroup = dialog.add("group");
    nameGroup.add("statictext", undefined, "Field Name (optional):");
    var fieldName = nameGroup.add("edittext", undefined, "");
    fieldName.characters = 30;

    // Buttons
    var buttonGroup = dialog.add("group");
    buttonGroup.alignment = "center";
    buttonGroup.add("button", undefined, "OK", {name: "ok"});
    buttonGroup.add("button", undefined, "Cancel", {name: "cancel"});

    // Show dialog
    var result = dialog.show();

    if (result === 1) { // OK clicked
        var editableType = textRadio.value ? "EditableText" :
                          (imageRadio.value ? "EditableImage" : "Locked");
        var customName = fieldName.text;

        markElements(selection, editableType, customName);

        alert("Successfully marked " + selection.length + " element(s) as " + editableType);
    }
}

/**
 * Mark selected elements as editable
 */
function markElements(selection, editableType, customName) {
    for (var i = 0; i < selection.length; i++) {
        var item = selection[i];

        // Check if it's a valid item type
        if (item.constructor.name === "TextFrame" ||
            item.constructor.name === "Rectangle" ||
            item.constructor.name === "Oval" ||
            item.constructor.name === "Polygon") {

            // Set the label (this is what the IDML parser will read)
            item.label = editableType;

            // Add custom name if provided
            if (customName && customName !== "") {
                item.name = customName;
            }

            // Also set the layer name for visual identification in InDesign
            try {
                var layerLabel = item.itemLayer.name;
                if (layerLabel.indexOf("EDITABLE") === -1 && editableType !== "Locked") {
                    item.itemLayer.name = layerLabel + " [EDITABLE]";
                }
            } catch (e) {
                // Layer name might not be editable, ignore
            }

            // Add script label for more metadata
            item.insertLabel("cantoflow_editable", editableType);
            if (customName && customName !== "") {
                item.insertLabel("cantoflow_name", customName);
            }
        }
    }
}

/**
 * Batch process all text frames
 */
function batchMarkAllTextFrames() {
    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;
    var textFrames = doc.textFrames;

    if (textFrames.length === 0) {
        alert("No text frames found in document.");
        return;
    }

    if (confirm("Mark all " + textFrames.length + " text frames as editable?")) {
        for (var i = 0; i < textFrames.length; i++) {
            textFrames[i].label = "EditableText";
            textFrames[i].insertLabel("cantoflow_editable", "EditableText");
        }
        alert("Marked " + textFrames.length + " text frames as editable.");
    }
}

/**
 * Batch process all image frames (rectangles with images)
 */
function batchMarkAllImageFrames() {
    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;
    var rectangles = doc.rectangles;
    var imageCount = 0;

    for (var i = 0; i < rectangles.length; i++) {
        var rect = rectangles[i];

        // Check if rectangle contains an image
        if (rect.images.length > 0 || rect.epss.length > 0 || rect.pdfs.length > 0) {
            rect.label = "EditableImage";
            rect.insertLabel("cantoflow_editable", "EditableImage");
            imageCount++;
        }
    }

    if (imageCount > 0) {
        alert("Marked " + imageCount + " image frames as editable.");
    } else {
        alert("No image frames found in document.");
    }
}

/**
 * Clear all markings
 */
function clearAllMarkings() {
    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;

    if (!confirm("Clear all CantoFlow markings from this document?")) {
        return;
    }

    var allItems = doc.allPageItems;
    var clearedCount = 0;

    for (var i = 0; i < allItems.length; i++) {
        var item = allItems[i];

        if (item.label.indexOf("Editable") !== -1 || item.label === "Locked") {
            item.label = "";
            try {
                item.extractLabel("cantoflow_editable");
                item.extractLabel("cantoflow_name");
            } catch (e) {
                // Label might not exist
            }
            clearedCount++;
        }
    }

    alert("Cleared markings from " + clearedCount + " item(s).");
}

/**
 * Show info about marked elements
 */
function showMarkedElementsInfo() {
    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;
    var allItems = doc.allPageItems;
    var editableText = 0;
    var editableImage = 0;
    var locked = 0;

    for (var i = 0; i < allItems.length; i++) {
        var item = allItems[i];

        if (item.label === "EditableText") {
            editableText++;
        } else if (item.label === "EditableImage") {
            editableImage++;
        } else if (item.label === "Locked") {
            locked++;
        }
    }

    var message = "CantoFlow Editable Elements Summary:\n\n";
    message += "Editable Text Fields: " + editableText + "\n";
    message += "Editable Image Fields: " + editableImage + "\n";
    message += "Locked Elements: " + locked + "\n";
    message += "\nTotal Marked: " + (editableText + editableImage + locked);

    alert(message);
}

// Create menu dialog for different operations
function showMainMenu() {
    var dialog = new Window("dialog", "CantoFlow - Template Preparation");
    dialog.alignChildren = "fill";

    // Title
    var titleGroup = dialog.add("panel", undefined, "Prepare InDesign Template for CantoFlow");
    titleGroup.alignChildren = "left";
    titleGroup.add("statictext", undefined, "Choose an operation:");

    // Buttons
    var btnGroup = dialog.add("group");
    btnGroup.orientation = "column";
    btnGroup.alignChildren = "fill";

    var btn1 = btnGroup.add("button", undefined, "1. Mark Selected Elements");
    var btn2 = btnGroup.add("button", undefined, "2. Mark All Text Frames");
    var btn3 = btnGroup.add("button", undefined, "3. Mark All Image Frames");
    var btn4 = btnGroup.add("button", undefined, "4. Show Summary");
    var btn5 = btnGroup.add("button", undefined, "5. Clear All Markings");

    btnGroup.add("statictext", undefined, "─────────────────────────");
    var btnCancel = btnGroup.add("button", undefined, "Cancel");

    // Button handlers
    btn1.onClick = function() {
        dialog.close();
        main();
    };

    btn2.onClick = function() {
        dialog.close();
        batchMarkAllTextFrames();
    };

    btn3.onClick = function() {
        dialog.close();
        batchMarkAllImageFrames();
    };

    btn4.onClick = function() {
        dialog.close();
        showMarkedElementsInfo();
    };

    btn5.onClick = function() {
        dialog.close();
        clearAllMarkings();
    };

    btnCancel.onClick = function() {
        dialog.close();
    };

    dialog.show();
}

// Run the main menu
showMainMenu();
