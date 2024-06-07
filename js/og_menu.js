/**
 * @file
 * Javascript magic. Shows the eligible menu options when switching groups.
 */
(function ($) {

Backdrop.ogMenu = Backdrop.ogMenu || {};

Backdrop.behaviors.ogMenuGroupswitch = {
  attach: function(context) {
    // Initialize variables and form.
    if (Backdrop.settings.ogMenu.mlid !== 0) {
      Backdrop.ogMenu.originalParent = $('.menu-parent-select').val(); // Get original parent.
    }
    else {
      Backdrop.ogMenu.originalParent = null;
    }
    Backdrop.ogMenu.selected = []; // Create Variable to hold selected groups
    Backdrop.ogMenu.bindEvents(); // Bind events to group audience fields.
    Backdrop.ogMenu.setSelected(); // Get all currently selected.
    Backdrop.ogMenu.populateParentSelect(); // Populate

    // Make sure the originalParent is set on page load.
    $('.menu-parent-select').val(Backdrop.ogMenu.originalParent);
  }
};

/**
 * Bind the needed events to all group audience reference fields.
 */
Backdrop.ogMenu.bindEvents = function() {
  var selector = '';
  $.each(Backdrop.settings.ogMenu.group_audience_fields, function (index, value) {
    // Only bind events to visible fields.
    if (value.visibility === true) {
      selector = Backdrop.ogMenu.buildSelector(index, value.normal, value.cardinality, value.normal_selector);
      Backdrop.ogMenu.bindEvent(value.normal, selector);
      if (Backdrop.settings.ogMenu.administer_group === true && value.admin !== undefined) {
        selector = Backdrop.ogMenu.buildSelector(index, value.admin, value.cardinality, value.admin_selector);
        Backdrop.ogMenu.bindEvent(value.admin, selector);
      }
    }
  });
};

/**
 * Helper to bind individual events
 */
Backdrop.ogMenu.bindEvent = function(type, selector) {
  // Autocomplete events can be tricky and need specific logic.
  if (type == 'entityreference_autocomplete') {
    $(selector).bind('autocompleteSelect', function() {
      Backdrop.ogMenu.setSelected();
      Backdrop.ogMenu.populateParentSelect();
    });
  }
  // Other fields are simpler.
  else {
    $(selector).change( function() {
      Backdrop.ogMenu.setSelected();
      Backdrop.ogMenu.populateParentSelect();
    });
  }
};

/**
 * Get selectors of all possible fields.
 */
Backdrop.ogMenu.getSelectors = function() {
  var fields =  Backdrop.settings.ogMenu.group_audience_fields;
  var selectors = [];
  $.each(fields, function (index, value) {
    selectors.push(Backdrop.ogMenu.buildSelector(index, value.normal, value.cardinality, value.normal_selector));
    if (Backdrop.settings.ogMenu.administer_group === true  && value.admin !== undefined) {
      selectors.push(Backdrop.ogMenu.buildSelector(index, value.admin, value.cardinality, value.admin_selector));
    }
  });
  return selectors;
};

/**
 * Build a selector for a given field.
 */
Backdrop.ogMenu.buildSelector = function(name, type, cardinality, base_selector) {
  var selector = '';
  if (type == 'options_buttons') {
    if (cardinality == 1) { // singular value, radio elements.
      selector += 'input[type="radio"][name^="' + base_selector + '"]';
    }
    else { // plural values, checkbox elements.
      selector += 'input[type="checkbox"][name^="' + base_selector + '"]';
    }
  }
  else if (type == 'options_select') {
    selector += 'select[name^="' + base_selector + '"]';
  }
  else if (type == 'entityreference_autocomplete') {
    selector += 'input[type="text"][name^="' + base_selector + '"].form-autocomplete';
  }
  return selector;
};

/**
 * Build a selector for a given field.
 */
Backdrop.ogMenu.getGroupRefVal = function(name, type, cardinality, base_selector) {
  var val = [];
  var selector = '';
  if (type == 'options_buttons') {
    if (cardinality == 1) { // singular value, radio elements.
      selector = 'input[type="radio"][name^="' + base_selector + '"]:checked';
      val.push($(selector).val());
    }
    else { // plural values, checkbox elements.
      selector = 'input[type="checkbox"][name^="' + base_selector + '"]:checked';
      $(selector).each(function(i) {
        val.push($(this).val());
      });
    }
  }
  else if (type == 'options_select') {  // Handle Selects
    $selector = $('select[name^="' + base_selector + '"]');
    if ($selector.attr('multiple')) {
      $selector.each(function(i) {
        if ($(this).val() !== null) {
          $.merge(val, $(this).val());
        }
      });
    }
    else {
      val.push($selector.val());
    }
  }
  else if (type == 'entityreference_autocomplete') { // Handle Autocompletes
    selector = 'input[type="text"][name^="' + base_selector + '"].form-autocomplete';
    $(selector).each(function(i) {
      var str = $(this).val();
      // @TODO Replace with regex for multiple items in Autocomplete (Tags style)?
      str = str.substring(str.lastIndexOf('(') + 1, str.lastIndexOf(')'));
      if (str !== '') {
        val.push(str);
      }
    });
  }
  return val;
};

/**
 * Adds all group reference values to selected array.
 */
Backdrop.ogMenu.setSelected = function() {
  Backdrop.ogMenu.selected = []; // Clear previous values.
  var fields =  Backdrop.settings.ogMenu.group_audience_fields;
  $.each(fields, function (index, value) {
    // When dealing with visible fields, get the value from DOM.
    if (value.visibility === true) {
      Backdrop.ogMenu.addSelected(
        Backdrop.ogMenu.getGroupRefVal(index, value.normal, value.cardinality, value.normal_selector)
      );
      if (Backdrop.settings.ogMenu.administer_group === true && value.admin !== undefined) {
        Backdrop.ogMenu.addSelected(
          Backdrop.ogMenu.getGroupRefVal(index, value.admin, value.cardinality, value.admin_selector)
        );
      }
    }
    // When fields are invisible, a context has been previously set.
    else {
      Backdrop.ogMenu.addSelected(value.visibility);
    }
  });
};

/**
 * Helper to add items to Drupal.ogMenu.selected without duplicates
 * Handles arrays as well as single values.
 * Recursive function.
 */
Backdrop.ogMenu.addSelected = function(val) {
  if (val instanceof Array) {
    $.each(val, function (index, value) {
      Backdrop.ogMenu.addSelected(value);
    });
  }
  else {
    if (val != '_none' && val !== '' && val !== null && val !== undefined) {
      val = parseInt(val, 10);
      if ($.inArray(val, Backdrop.ogMenu.selected) == -1) {
        Backdrop.ogMenu.selected.push(val);
      }
    }
  }
};


/**
 * Populate the .menu-parent-select select with all available menus and og_menus.
 * This also sets as active the first menu for the first selected group.
 */
Backdrop.ogMenu.populateParentSelect = function() {
  // Remove all options from the select to rebuild it.
  $('.menu-parent-select option').remove();

  // Add any non og_menus to the menu-parent-select menu.
  $.each(Backdrop.settings.ogMenu.standard_parent_options, function(key, val) {
    $('.menu-parent-select').append($("<option>", {value: key, text: val}));
  });

  var parentToSetActive = Backdrop.ogMenu.selected[0];
  var activeIsSet = Backdrop.ogMenu.originalParent;

  // Add any og_menus to the menu-parent-select menu
  $.each(Backdrop.settings.ogMenu.menus, function(menu_name, gid) {
    if ($.inArray(parseInt(gid, 10), Backdrop.ogMenu.selected) >= 0)  {
      $.each(Backdrop.settings.ogMenu.parent_options, function(key,val) {
        var parts = key.split(':');

        if (parts[0] === menu_name) {
          // Current gid matches with menu parent to activate, no link was set previously.
          if (gid == parentToSetActive && activeIsSet === null) {
            // Add option to Select and set as selected.
            $('.menu-parent-select').append($("<option>", {value: key, text: val, selected: 'selected'}));
            activeIsSet = 1;
          }
          //
          else if (Backdrop.settings.ogMenu.mlid !== 0 && Backdrop.settings.ogMenu.mlid == parts[1]) {
            $('.menu-parent-select').append($("<option>", {value: key, text: val + ' [Current Menu Position]', disabled: 'disabled'}));
            // Don't add this item to parent list...
            // Set the parent so we don't lose our place.
            $('.menu-parent-select').val(activeIsSet);
          }
          else {
            // Add option to select.
            $('.menu-parent-select').append($("<option>", {value: key, text: val}));
          }
        }

      });
    }
  });
};

}(jQuery));
