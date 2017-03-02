// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// TODO(rltoscano): Move data/* into print_preview.data namespace

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Class that represents a UI component.
   * @constructor
   * @extends {cr.EventTarget}
   */
  function Component() {
    cr.EventTarget.call(this);

    /**
     * Component's HTML element.
     * @type {Element}
     * @private
     */
    this.element_ = null;

    this.isInDocument_ = false;

    /**
     * Component's event tracker.
     * @type {EventTracker}
     * @private
     */
     this.tracker_ = new EventTracker();

    /**
     * Child components of the component.
     * @type {!Array<!print_preview.Component>}
     * @private
     */
    this.children_ = [];
  };

  Component.prototype = {
    __proto__: cr.EventTarget.prototype,

    /** Gets the component's element. */
    getElement: function() {
      return this.element_;
    },

    /** @return {EventTracker} Component's event tracker. */
    get tracker() {
      return this.tracker_;
    },

    /**
     * @return {boolean} Whether the element of the component is already in the
     *     HTML document.
     */
    get isInDocument() {
      return this.isInDocument_;
    },

    /**
     * Creates the root element of the component. Sub-classes should override
     * this method.
     */
    createDom: function() {
      this.element_ = cr.doc.createElement('div');
    },

    /**
     * Called when the component's element is known to be in the document.
     * Anything using document.getElementById etc. should be done at this stage.
     * Sub-classes should extend this method and attach listeners.
     */
    enterDocument: function() {
      this.isInDocument_ = true;
      this.children_.forEach(function(child) {
        if (!child.isInDocument && child.getElement()) {
          child.enterDocument();
        }
      });
    },

    /** Removes all event listeners. */
    exitDocument: function() {
      this.children_.forEach(function(child) {
        if (child.isInDocument) {
          child.exitDocument();
        }
      });
      this.tracker_.removeAll();
      this.isInDocument_ = false;
    },

    /**
     * Renders this UI component and appends the element to the given parent
     * element.
     * @param {!Element} parentElement Element to render the component's
     *     element into.
     */
    render: function(parentElement) {
      assert(!this.isInDocument, 'Component is already in the document');
      if (!this.element_) {
        this.createDom();
      }
      parentElement.appendChild(this.element_);
      this.enterDocument();
    },

    /**
     * Decorates an existing DOM element. Sub-classes should override the
     * override the decorateInternal method.
     * @param {Element} element Element to decorate.
     */
    decorate: function(element) {
      assert(!this.isInDocument, 'Component is already in the document');
      this.setElementInternal(element);
      this.decorateInternal();
      this.enterDocument();
    },

    /**
     * @return {!Array<!print_preview.Component>} Child components of this
     *     component.
     */
    get children() {
      return this.children_;
    },

    /**
     * @param {!print_preview.Component} child Component to add as a child of
     *     this component.
     */
    addChild: function(child) {
      this.children_.push(child);
    },

    /**
     * @param {!print_preview.Component} child Component to remove from this
     *     component's children.
     */
    removeChild: function(child) {
      var childIdx = this.children_.indexOf(child);
      if (childIdx != -1) {
        this.children_.splice(childIdx, 1);
      }
      if (child.isInDocument) {
        child.exitDocument();
        if (child.getElement()) {
          child.getElement().parentNode.removeChild(child.getElement());
        }
      }
    },

    /** Removes all of the component's children. */
    removeChildren: function() {
      while (this.children_.length > 0) {
        this.removeChild(this.children_[0]);
      }
    },

    /**
     * @param {string} query Selector query to select an element starting from
     *     the component's root element using a depth first search for the first
     *     element that matches the query.
     * @return {HTMLElement} Element selected by the given query.
     * TODO(alekseys): Check all call sites and rename this function to
     *     something like getRequiredChildElement.
     */
    getChildElement: function(query) {
      return this.element_.querySelector(query);
    },

    /**
     * Sets the component's element.
     * @param {Element} element HTML element to set as the component's element.
     * @protected
     */
    setElementInternal: function(element) {
      this.element_ = element;
    },

    /**
     * Decorates the given element for use as the element of the component.
     * @protected
     */
    decorateInternal: function() { /*abstract*/ },

    /**
     * Clones a template HTML DOM tree.
     * @param {string} templateId Template element ID.
     * @param {boolean=} opt_keepHidden Whether to leave the cloned template
     *     hidden after cloning.
     * @return {Element} Cloned element with its 'id' attribute stripped.
     * @protected
     */
    cloneTemplateInternal: function(templateId, opt_keepHidden) {
      var templateEl = $(templateId);
      assert(templateEl != null,
             'Could not find element with ID: ' + templateId);
      var el = assertInstanceof(templateEl.cloneNode(true), HTMLElement);
      el.id = '';
      if (!opt_keepHidden) {
        setIsVisible(el, true);
      }
      return el;
    }
  };

  return {
    Component: Component
  };
});

// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * FocusManager implementation specialized for Print Preview, which ensures
   * that Print Preview itself does not receive focus when an overlay is shown.
   * @constructor
   * @extends {cr.ui.FocusManager}
   */
  function PrintPreviewFocusManager() {
  };

  cr.addSingletonGetter(PrintPreviewFocusManager);

  PrintPreviewFocusManager.prototype = {
    __proto__: cr.ui.FocusManager.prototype,

    /** @override */
    getFocusParent: function() {
      var el = document.body;
      var newEl = null;
      while (newEl = el.querySelector('.overlay:not([hidden])'))
        el = newEl;
      return el;
    }
  };

  // Export
  return {
    PrintPreviewFocusManager: PrintPreviewFocusManager
  };
});


cr.define('print_preview', function() {
  'use strict';

  /**
   * Container class for Chromium's print preview.
   * @constructor
   * @extends {print_preview.Component}
   */
  function PrintPreview() {
    print_preview.Component.call(this);

    /**
     * Used to communicate with Chromium's print system.
     * @type {!print_preview.NativeLayer}
     * @private
     */
    this.nativeLayer_ = new print_preview.NativeLayer();

    /**
     * Event target that contains information about the logged in user.
     * @type {!print_preview.UserInfo}
     * @private
     */
    this.userInfo_ = new print_preview.UserInfo();

    /**
     * Application state.
     * @type {!print_preview.AppState}
     * @private
     */
    this.appState_ = new print_preview.AppState();

    /**
     * Data model that holds information about the document to print.
     * @type {!print_preview.DocumentInfo}
     * @private
     */
    this.documentInfo_ = new print_preview.DocumentInfo();

    /**
     * Data store which holds print destinations.
     * @type {!print_preview.DestinationStore}
     * @private
     */
    this.destinationStore_ = new print_preview.DestinationStore(
        this.nativeLayer_, this.userInfo_, this.appState_);

    /**
     * Data store which holds printer sharing invitations.
     * @type {!print_preview.InvitationStore}
     * @private
     */
    this.invitationStore_ = new print_preview.InvitationStore(this.userInfo_);

    /**
     * Storage of the print ticket used to create the print job.
     * @type {!print_preview.PrintTicketStore}
     * @private
     */
    this.printTicketStore_ = new print_preview.PrintTicketStore(
        this.destinationStore_, this.appState_, this.documentInfo_);

    /**
     * Holds the print and cancel buttons and renders some document statistics.
     * @type {!print_preview.PrintHeader}
     * @private
     */
    this.printHeader_ = new print_preview.PrintHeader(
        this.printTicketStore_, this.destinationStore_);
    this.addChild(this.printHeader_);

    /**
     * Component used to search for print destinations.
     * @type {!print_preview.DestinationSearch}
     * @private
     */
    this.destinationSearch_ = new print_preview.DestinationSearch(
        this.destinationStore_, this.invitationStore_, this.userInfo_);
    this.addChild(this.destinationSearch_);

    /**
     * Component that renders the print destination.
     * @type {!print_preview.DestinationSettings}
     * @private
     */
    this.destinationSettings_ = new print_preview.DestinationSettings(
        this.destinationStore_);
    this.addChild(this.destinationSettings_);

    /**
     * Component that renders UI for entering in page range.
     * @type {!print_preview.PageSettings}
     * @private
     */
    this.pageSettings_ = new print_preview.PageSettings(
        this.printTicketStore_.pageRange);
    this.addChild(this.pageSettings_);

    /**
     * Component that renders the copies settings.
     * @type {!print_preview.CopiesSettings}
     * @private
     */
    this.copiesSettings_ = new print_preview.CopiesSettings(
        this.printTicketStore_.copies, this.printTicketStore_.collate);
    this.addChild(this.copiesSettings_);

    /**
     * Component that renders the media size settings.
     * @type {!print_preview.MediaSizeSettings}
     * @private
     */
    this.mediaSizeSettings_ =
        new print_preview.MediaSizeSettings(this.printTicketStore_.mediaSize);
    this.addChild(this.mediaSizeSettings_);

    /**
     * Component that renders the layout settings.
     * @type {!print_preview.LayoutSettings}
     * @private
     */
    this.layoutSettings_ =
        new print_preview.LayoutSettings(this.printTicketStore_.landscape);
    this.addChild(this.layoutSettings_);

    /**
     * Component that renders the color options.
     * @type {!print_preview.ColorSettings}
     * @private
     */
    this.colorSettings_ =
        new print_preview.ColorSettings(this.printTicketStore_.color);
    this.addChild(this.colorSettings_);

    /**
     * Component that renders a select box for choosing margin settings.
     * @type {!print_preview.MarginSettings}
     * @private
     */
    this.marginSettings_ =
        new print_preview.MarginSettings(this.printTicketStore_.marginsType);
    this.addChild(this.marginSettings_);

    /**
     * Component that renders the DPI settings.
     * @type {!print_preview.DpiSettings}
     * @private
     */
    this.dpiSettings_ =
        new print_preview.DpiSettings(this.printTicketStore_.dpi);
    this.addChild(this.dpiSettings_);

    /**
     * Component that renders miscellaneous print options.
     * @type {!print_preview.OtherOptionsSettings}
     * @private
     */
    this.otherOptionsSettings_ = new print_preview.OtherOptionsSettings(
        this.printTicketStore_.duplex,
        this.printTicketStore_.fitToPage,
        this.printTicketStore_.cssBackground,
        this.printTicketStore_.selectionOnly,
        this.printTicketStore_.headerFooter);
    this.addChild(this.otherOptionsSettings_);

    /**
     * Component that renders the advanced options button.
     * @type {!print_preview.AdvancedOptionsSettings}
     * @private
     */
    this.advancedOptionsSettings_ = new print_preview.AdvancedOptionsSettings(
        this.printTicketStore_.vendorItems, this.destinationStore_);
    this.addChild(this.advancedOptionsSettings_);

    /**
     * Component used to search for print destinations.
     * @type {!print_preview.AdvancedSettings}
     * @private
     */
    this.advancedSettings_ = new print_preview.AdvancedSettings(
        this.printTicketStore_);
    this.addChild(this.advancedSettings_);

    var settingsSections = [
        this.destinationSettings_,
        this.pageSettings_,
        this.copiesSettings_,
        this.mediaSizeSettings_,
        this.layoutSettings_,
        this.marginSettings_,
        this.colorSettings_,
        this.dpiSettings_,
        this.otherOptionsSettings_,
        this.advancedOptionsSettings_];
    /**
     * Component representing more/less settings button.
     * @type {!print_preview.MoreSettings}
     * @private
     */
    this.moreSettings_ = new print_preview.MoreSettings(
        this.destinationStore_, settingsSections);
    this.addChild(this.moreSettings_);

    /**
     * Area of the UI that holds the print preview.
     * @type {!print_preview.PreviewArea}
     * @private
     */
    this.previewArea_ = new print_preview.PreviewArea(this.destinationStore_,
                                                      this.printTicketStore_,
                                                      this.nativeLayer_,
                                                      this.documentInfo_);
    this.addChild(this.previewArea_);

    /**
     * Interface to the Google Cloud Print API. Null if Google Cloud Print
     * integration is disabled.
     * @type {cloudprint.CloudPrintInterface}
     * @private
     */
    this.cloudPrintInterface_ = null;

    /**
     * Whether in kiosk mode where print preview can print automatically without
     * user intervention. See http://crbug.com/31395. Print will start when
     * both the print ticket has been initialized, and an initial printer has
     * been selected.
     * @type {boolean}
     * @private
     */
    this.isInKioskAutoPrintMode_ = false;

    /**
     * Whether Print Preview is in App Kiosk mode, basically, use only printers
     * available for the device.
     * @type {boolean}
     * @private
     */
    this.isInAppKioskMode_ = false;

    /**
     * Whether Print with System Dialog link should be hidden. Overrides the
     * default rules for System dialog link visibility.
     * @type {boolean}
     * @private
     */
    this.hideSystemDialogLink_ = true;

    /**
     * State of the print preview UI.
     * @type {print_preview.PrintPreview.UiState_}
     * @private
     */
    this.uiState_ = PrintPreview.UiState_.INITIALIZING;

    /**
     * Whether document preview generation is in progress.
     * @type {boolean}
     * @private
     */
    this.isPreviewGenerationInProgress_ = true;

    /**
     * Whether to show system dialog before next printing.
     * @type {boolean}
     * @private
     */
    this.showSystemDialogBeforeNextPrint_ = false;
  };

  /**
   * States of the print preview.
   * @enum {string}
   * @private
   */
  PrintPreview.UiState_ = {
    INITIALIZING: 'initializing',
    READY: 'ready',
    OPENING_PDF_PREVIEW: 'opening-pdf-preview',
    OPENING_NATIVE_PRINT_DIALOG: 'opening-native-print-dialog',
    PRINTING: 'printing',
    FILE_SELECTION: 'file-selection',
    CLOSING: 'closing',
    ERROR: 'error'
  };

  /**
   * What can happen when print preview tries to print.
   * @enum {string}
   * @private
   */
  PrintPreview.PrintAttemptResult_ = {
    NOT_READY: 'not-ready',
    PRINTED: 'printed',
    READY_WAITING_FOR_PREVIEW: 'ready-waiting-for-preview'
  };

  PrintPreview.prototype = {
    __proto__: print_preview.Component.prototype,

    /** Sets up the page and print preview by getting the printer list. */
    initialize: function() {
      this.decorate($('print-preview'));
      if (!this.previewArea_.hasCompatiblePlugin) {
        this.setIsEnabled_(false);
      }
      this.nativeLayer_.startGetInitialSettings();
      print_preview.PrintPreviewFocusManager.getInstance().initialize();
      cr.ui.FocusOutlineManager.forDocument(document);
    },

    /** @override */
    enterDocument: function() {
      // Native layer events.
      this.tracker.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.INITIAL_SETTINGS_SET,
          this.onInitialSettingsSet_.bind(this));
      this.tracker.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.CLOUD_PRINT_ENABLE,
          this.onCloudPrintEnable_.bind(this));
      this.tracker.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.PRINT_TO_CLOUD,
          this.onPrintToCloud_.bind(this));
      this.tracker.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.FILE_SELECTION_CANCEL,
          this.onFileSelectionCancel_.bind(this));
      this.tracker.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.FILE_SELECTION_COMPLETE,
          this.onFileSelectionComplete_.bind(this));
      this.tracker.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.SETTINGS_INVALID,
          this.onSettingsInvalid_.bind(this));
      this.tracker.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.PRINT_PRESET_OPTIONS,
          this.onPrintPresetOptionsFromDocument_.bind(this));
      this.tracker.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.PRIVET_PRINT_FAILED,
          this.onPrivetPrintFailed_.bind(this));
      this.tracker.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.MANIPULATE_SETTINGS_FOR_TEST,
          this.onManipulateSettingsForTest_.bind(this));

      if ($('system-dialog-link')) {
        this.tracker.add(
            $('system-dialog-link'),
            'click',
            this.openSystemPrintDialog_.bind(this));
      }
      if ($('open-pdf-in-preview-link')) {
        this.tracker.add(
            $('open-pdf-in-preview-link'),
            'click',
            this.onOpenPdfInPreviewLinkClick_.bind(this));
      }

      this.tracker.add(
          this.previewArea_,
          print_preview.PreviewArea.EventType.PREVIEW_GENERATION_IN_PROGRESS,
          this.onPreviewGenerationInProgress_.bind(this));
      this.tracker.add(
          this.previewArea_,
          print_preview.PreviewArea.EventType.PREVIEW_GENERATION_DONE,
          this.onPreviewGenerationDone_.bind(this));
      this.tracker.add(
          this.previewArea_,
          print_preview.PreviewArea.EventType.PREVIEW_GENERATION_FAIL,
          this.onPreviewGenerationFail_.bind(this));
      this.tracker.add(
          this.previewArea_,
          print_preview.PreviewArea.EventType.OPEN_SYSTEM_DIALOG_CLICK,
          this.openSystemPrintDialog_.bind(this));

      this.tracker.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.
              SELECTED_DESTINATION_CAPABILITIES_READY,
          this.printIfReady_.bind(this));
      this.tracker.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.DESTINATION_SELECT,
          this.onDestinationSelect_.bind(this));
      this.tracker.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.DESTINATION_SEARCH_DONE,
          this.onDestinationSearchDone_.bind(this));

      this.tracker.add(
          this.printHeader_,
          print_preview.PrintHeader.EventType.PRINT_BUTTON_CLICK,
          this.onPrintButtonClick_.bind(this));
      this.tracker.add(
          this.printHeader_,
          print_preview.PrintHeader.EventType.CANCEL_BUTTON_CLICK,
          this.onCancelButtonClick_.bind(this));

      this.tracker.add(window, 'keydown', this.onKeyDown_.bind(this));
      this.previewArea_.setPluginKeyEventCallback(this.onKeyDown_.bind(this));

      this.tracker.add(
          this.destinationSettings_,
          print_preview.DestinationSettings.EventType.CHANGE_BUTTON_ACTIVATE,
          this.onDestinationChangeButtonActivate_.bind(this));

      this.tracker.add(
          this.destinationSearch_,
          print_preview.DestinationSearch.EventType.MANAGE_CLOUD_DESTINATIONS,
          this.onManageCloudDestinationsActivated_.bind(this));
      this.tracker.add(
          this.destinationSearch_,
          print_preview.DestinationSearch.EventType.MANAGE_LOCAL_DESTINATIONS,
          this.onManageLocalDestinationsActivated_.bind(this));
      this.tracker.add(
          this.destinationSearch_,
          print_preview.DestinationSearch.EventType.ADD_ACCOUNT,
          this.onCloudPrintSignInActivated_.bind(this, true /*addAccount*/));
      this.tracker.add(
          this.destinationSearch_,
          print_preview.DestinationSearch.EventType.SIGN_IN,
          this.onCloudPrintSignInActivated_.bind(this, false /*addAccount*/));
      this.tracker.add(
          this.destinationSearch_,
          print_preview.DestinationListItem.EventType.REGISTER_PROMO_CLICKED,
          this.onCloudPrintRegisterPromoClick_.bind(this));

      this.tracker.add(
          this.advancedOptionsSettings_,
          print_preview.AdvancedOptionsSettings.EventType.BUTTON_ACTIVATED,
          this.onAdvancedOptionsButtonActivated_.bind(this));

      // TODO(rltoscano): Move no-destinations-promo into its own component
      // instead being part of PrintPreview.
      this.tracker.add(
          this.getChildElement('#no-destinations-promo .close-button'),
          'click',
          this.onNoDestinationsPromoClose_.bind(this));
      this.tracker.add(
          this.getChildElement('#no-destinations-promo .not-now-button'),
          'click',
          this.onNoDestinationsPromoClose_.bind(this));
      this.tracker.add(
          this.getChildElement('#no-destinations-promo .add-printer-button'),
          'click',
          this.onNoDestinationsPromoClick_.bind(this));
    },

    /** @override */
    decorateInternal: function() {
      this.printHeader_.decorate($('print-header'));
      this.destinationSearch_.decorate($('destination-search'));
      this.destinationSettings_.decorate($('destination-settings'));
      this.pageSettings_.decorate($('page-settings'));
      this.copiesSettings_.decorate($('copies-settings'));
      this.mediaSizeSettings_.decorate($('media-size-settings'));
      this.layoutSettings_.decorate($('layout-settings'));
      this.colorSettings_.decorate($('color-settings'));
      this.marginSettings_.decorate($('margin-settings'));
      this.dpiSettings_.decorate($('dpi-settings'));
      this.otherOptionsSettings_.decorate($('other-options-settings'));
      this.advancedOptionsSettings_.decorate($('advanced-options-settings'));
      this.advancedSettings_.decorate($('advanced-settings'));
      this.moreSettings_.decorate($('more-settings'));
      this.previewArea_.decorate($('preview-area'));
    },

    /**
     * Sets whether the controls in the print preview are enabled.
     * @param {boolean} isEnabled Whether the controls in the print preview are
     *     enabled.
     * @private
     */
    setIsEnabled_: function(isEnabled) {
      if ($('system-dialog-link'))
        $('system-dialog-link').classList.toggle('disabled', !isEnabled);
      if ($('open-pdf-in-preview-link'))
        $('open-pdf-in-preview-link').classList.toggle('disabled', !isEnabled);
      this.printHeader_.isEnabled = isEnabled;
      this.destinationSettings_.isEnabled = isEnabled;
      this.pageSettings_.isEnabled = isEnabled;
      this.copiesSettings_.isEnabled = isEnabled;
      this.mediaSizeSettings_.isEnabled = isEnabled;
      this.layoutSettings_.isEnabled = isEnabled;
      this.colorSettings_.isEnabled = isEnabled;
      this.marginSettings_.isEnabled = isEnabled;
      this.dpiSettings_.isEnabled = isEnabled;
      this.otherOptionsSettings_.isEnabled = isEnabled;
      this.advancedOptionsSettings_.isEnabled = isEnabled;
    },

    /**
     * Prints the document or launches a pdf preview on the local system.
     * @param {boolean} isPdfPreview Whether to launch the pdf preview.
     * @private
     */
    printDocumentOrOpenPdfPreview_: function(isPdfPreview) {
      assert(this.uiState_ == PrintPreview.UiState_.READY,
             'Print document request received when not in ready state: ' +
                 this.uiState_);
      if (isPdfPreview) {
        this.uiState_ = PrintPreview.UiState_.OPENING_PDF_PREVIEW;
      } else if (this.destinationStore_.selectedDestination.id ==
          print_preview.Destination.GooglePromotedId.SAVE_AS_PDF) {
        this.uiState_ = PrintPreview.UiState_.FILE_SELECTION;
      } else {
        this.uiState_ = PrintPreview.UiState_.PRINTING;
      }
      this.setIsEnabled_(false);
      this.printHeader_.isCancelButtonEnabled = true;
      var printAttemptResult = this.printIfReady_();
      if (printAttemptResult == PrintPreview.PrintAttemptResult_.PRINTED ||
          printAttemptResult ==
              PrintPreview.PrintAttemptResult_.READY_WAITING_FOR_PREVIEW) {
        if ((this.destinationStore_.selectedDestination.isLocal &&
             !this.destinationStore_.selectedDestination.isPrivet &&
             !this.destinationStore_.selectedDestination.isExtension &&
             this.destinationStore_.selectedDestination.id !=
                 print_preview.Destination.GooglePromotedId.SAVE_AS_PDF) ||
             this.uiState_ == PrintPreview.UiState_.OPENING_PDF_PREVIEW) {
          // Hide the dialog for now. The actual print command will be issued
          // when the preview generation is done.
          this.nativeLayer_.startHideDialog();
        }
      }
    },

    /**
     * Attempts to print if needed and if ready.
     * @return {PrintPreview.PrintAttemptResult_} Attempt result.
     * @private
     */
    printIfReady_: function() {
      var okToPrint =
          (this.uiState_ == PrintPreview.UiState_.PRINTING ||
           this.uiState_ == PrintPreview.UiState_.OPENING_PDF_PREVIEW ||
           this.uiState_ == PrintPreview.UiState_.FILE_SELECTION ||
           this.isInKioskAutoPrintMode_) &&
          this.destinationStore_.selectedDestination &&
          this.destinationStore_.selectedDestination.capabilities;
      if (!okToPrint) {
        return PrintPreview.PrintAttemptResult_.NOT_READY;
      }
      if (this.isPreviewGenerationInProgress_) {
        return PrintPreview.PrintAttemptResult_.READY_WAITING_FOR_PREVIEW;
      }
      assert(this.printTicketStore_.isTicketValid(),
          'Trying to print with invalid ticket');
      if (getIsVisible(this.moreSettings_.getElement())) {
        new print_preview.PrintSettingsUiMetricsContext().record(
            this.moreSettings_.isExpanded ?
                print_preview.Metrics.PrintSettingsUiBucket.
                    PRINT_WITH_SETTINGS_EXPANDED :
                print_preview.Metrics.PrintSettingsUiBucket.
                    PRINT_WITH_SETTINGS_COLLAPSED);
      }
      this.nativeLayer_.startPrint(
          this.destinationStore_.selectedDestination,
          this.printTicketStore_,
          this.cloudPrintInterface_,
          this.documentInfo_,
          this.uiState_ == PrintPreview.UiState_.OPENING_PDF_PREVIEW,
          this.showSystemDialogBeforeNextPrint_);
      this.showSystemDialogBeforeNextPrint_ = false;
      return PrintPreview.PrintAttemptResult_.PRINTED;
    },

    /**
     * Closes the print preview.
     * @private
     */
    close_: function() {
      this.exitDocument();
      this.uiState_ = PrintPreview.UiState_.CLOSING;
      this.nativeLayer_.startCloseDialog();
    },

    /**
     * Opens the native system print dialog after disabling all controls.
     * @private
     */
    openSystemPrintDialog_: function() {
      if (!this.shouldShowSystemDialogLink_())
        return;
      if ($('system-dialog-link').classList.contains('disabled'))
        return;
      if (cr.isWindows) {
        this.showSystemDialogBeforeNextPrint_ = true;
        this.printDocumentOrOpenPdfPreview_(false /*isPdfPreview*/);
        return;
      }
      setIsVisible(getRequiredElement('system-dialog-throbber'), true);
      this.setIsEnabled_(false);
      this.uiState_ = PrintPreview.UiState_.OPENING_NATIVE_PRINT_DIALOG;
      this.nativeLayer_.startShowSystemDialog();
    },

    /**
     * Called when the native layer has initial settings to set. Sets the
     * initial settings of the print preview and begins fetching print
     * destinations.
     * @param {Event} event Contains the initial print preview settings
     *     persisted through the session.
     * @private
     */
    onInitialSettingsSet_: function(event) {
      assert(this.uiState_ == PrintPreview.UiState_.INITIALIZING,
             'Updating initial settings when not in initializing state: ' +
                 this.uiState_);
      this.uiState_ = PrintPreview.UiState_.READY;

      var settings = event.initialSettings;
      this.isInKioskAutoPrintMode_ = settings.isInKioskAutoPrintMode;
      this.isInAppKioskMode_ = settings.isInAppKioskMode;

      // The following components must be initialized in this order.
      this.appState_.init(settings.serializedAppStateStr);
      this.documentInfo_.init(
          settings.isDocumentModifiable,
          settings.documentTitle,
          settings.documentHasSelection);
      this.printTicketStore_.init(
          settings.thousandsDelimeter,
          settings.decimalDelimeter,
          settings.unitType,
          settings.selectionOnly);
      this.destinationStore_.init(
          settings.isInAppKioskMode,
          settings.systemDefaultDestinationId,
          settings.serializedDefaultDestinationSelectionRulesStr);
      this.appState_.setInitialized();

      $('document-title').innerText = settings.documentTitle;
      this.hideSystemDialogLink_ = settings.isInAppKioskMode;
      if ($('system-dialog-link')) {
        setIsVisible($('system-dialog-link'),
                     this.shouldShowSystemDialogLink_());
      }
    },

    /**
     * Calls when the native layer enables Google Cloud Print integration.
     * Fetches the user's cloud printers.
     * @param {Event} event Contains the base URL of the Google Cloud Print
     *     service.
     * @private
     */
    onCloudPrintEnable_: function(event) {
      this.cloudPrintInterface_ = new cloudprint.CloudPrintInterface(
          event.baseCloudPrintUrl,
          this.nativeLayer_,
          this.userInfo_,
          event.appKioskMode);
      this.tracker.add(
          this.cloudPrintInterface_,
          cloudprint.CloudPrintInterface.EventType.SUBMIT_DONE,
          this.onCloudPrintSubmitDone_.bind(this));
      this.tracker.add(
          this.cloudPrintInterface_,
          cloudprint.CloudPrintInterface.EventType.SEARCH_FAILED,
          this.onCloudPrintError_.bind(this));
      this.tracker.add(
          this.cloudPrintInterface_,
          cloudprint.CloudPrintInterface.EventType.SUBMIT_FAILED,
          this.onCloudPrintError_.bind(this));
      this.tracker.add(
          this.cloudPrintInterface_,
          cloudprint.CloudPrintInterface.EventType.PRINTER_FAILED,
          this.onCloudPrintError_.bind(this));
      this.tracker.add(
          this.cloudPrintInterface_,
          cloudprint.CloudPrintInterface.EventType.
              UPDATE_PRINTER_TOS_ACCEPTANCE_FAILED,
          this.onCloudPrintError_.bind(this));

      this.destinationStore_.setCloudPrintInterface(this.cloudPrintInterface_);
      this.invitationStore_.setCloudPrintInterface(this.cloudPrintInterface_);
      if (this.destinationSearch_.getIsVisible()) {
        this.destinationStore_.startLoadCloudDestinations();
        this.invitationStore_.startLoadingInvitations();
      }
    },

    /**
     * Called from the native layer when ready to print to Google Cloud Print.
     * @param {Event} event Contains the body to send in the HTTP request.
     * @private
     */
    onPrintToCloud_: function(event) {
      assert(this.uiState_ == PrintPreview.UiState_.PRINTING,
             'Document ready to be sent to the cloud when not in printing ' +
                 'state: ' + this.uiState_);
      assert(this.cloudPrintInterface_ != null,
             'Google Cloud Print is not enabled');
      this.cloudPrintInterface_.submit(
          this.destinationStore_.selectedDestination,
          this.printTicketStore_,
          this.documentInfo_,
          event.data);
    },

    /**
     * Called from the native layer when the user cancels the save-to-pdf file
     * selection dialog.
     * @private
     */
    onFileSelectionCancel_: function() {
      assert(this.uiState_ == PrintPreview.UiState_.FILE_SELECTION,
             'File selection cancelled when not in file-selection state: ' +
                 this.uiState_);
      this.setIsEnabled_(true);
      this.uiState_ = PrintPreview.UiState_.READY;
    },

    /**
     * Called from the native layer when save-to-pdf file selection is complete.
     * @private
     */
    onFileSelectionComplete_: function() {
      assert(this.uiState_ == PrintPreview.UiState_.FILE_SELECTION,
             'File selection completed when not in file-selection state: ' +
                 this.uiState_);
      this.previewArea_.showCustomMessage(
          loadTimeData.getString('printingToPDFInProgress'));
      this.uiState_ = PrintPreview.UiState_.PRINTING;
    },

    /**
     * Called after successfully submitting a job to Google Cloud Print.
     * @param {!Event} event Contains the ID of the submitted print job.
     * @private
     */
    onCloudPrintSubmitDone_: function(event) {
      assert(this.uiState_ == PrintPreview.UiState_.PRINTING,
             'Submited job to Google Cloud Print but not in printing state ' +
                 this.uiState_);
      if (this.destinationStore_.selectedDestination.id ==
              print_preview.Destination.GooglePromotedId.FEDEX) {
        this.nativeLayer_.startForceOpenNewTab(
            'https://www.google.com/cloudprint/fedexcode.html?jobid=' +
            event.jobId);
      }
      this.close_();
    },

    /**
     * Called when there was an error communicating with Google Cloud print.
     * Displays an error message in the print header.
     * @param {!Event} event Contains the error message.
     * @private
     */
    onCloudPrintError_: function(event) {
      if (event.status == 403) {
        if (!this.isInAppKioskMode_) {
          this.destinationSearch_.showCloudPrintPromo();
        }
      } else if (event.status == 0) {
        return; // Ignore, the system does not have internet connectivity.
      } else {
        this.printHeader_.setErrorMessage(event.message);
      }
      if (event.status == 200) {
        console.error('Google Cloud Print Error: (' + event.errorCode + ') ' +
                      event.message);
      } else {
        console.error('Google Cloud Print Error: HTTP status ' + event.status);
      }
    },

    /**
     * Called when the preview area's preview generation is in progress.
     * @private
     */
    onPreviewGenerationInProgress_: function() {
      this.isPreviewGenerationInProgress_ = true;
    },

    /**
     * Called when the preview area's preview generation is complete.
     * @private
     */
    onPreviewGenerationDone_: function() {
      this.isPreviewGenerationInProgress_ = false;
      this.printHeader_.isPrintButtonEnabled = true;
      this.nativeLayer_.previewReadyForTest();
      this.printIfReady_();
    },

    /**
     * Called when the preview area's preview failed to load.
     * @private
     */
    onPreviewGenerationFail_: function() {
      this.isPreviewGenerationInProgress_ = false;
      this.printHeader_.isPrintButtonEnabled = false;
      if (this.uiState_ == PrintPreview.UiState_.PRINTING)
        this.nativeLayer_.startCancelPendingPrint();
    },

    /**
     * Called when the 'Open pdf in preview' link is clicked. Launches the pdf
     * preview app.
     * @private
     */
    onOpenPdfInPreviewLinkClick_: function() {
      if ($('open-pdf-in-preview-link').classList.contains('disabled'))
        return;
      assert(this.uiState_ == PrintPreview.UiState_.READY,
             'Trying to open pdf in preview when not in ready state: ' +
                 this.uiState_);
      setIsVisible(getRequiredElement('open-preview-app-throbber'), true);
      this.previewArea_.showCustomMessage(
          loadTimeData.getString('openingPDFInPreview'));
      this.printDocumentOrOpenPdfPreview_(true /*isPdfPreview*/);
    },

    /**
     * Called when the print header's print button is clicked. Prints the
     * document.
     * @private
     */
    onPrintButtonClick_: function() {
      assert(this.uiState_ == PrintPreview.UiState_.READY,
             'Trying to print when not in ready state: ' + this.uiState_);
      this.printDocumentOrOpenPdfPreview_(false /*isPdfPreview*/);
    },

    /**
     * Called when the print header's cancel button is clicked. Closes the
     * print dialog.
     * @private
     */
    onCancelButtonClick_: function() {
      this.close_();
    },

    /**
     * Called when the register promo for Cloud Print is clicked.
     * @private
     */
     onCloudPrintRegisterPromoClick_: function(e) {
       var devicesUrl = 'chrome://devices/register?id=' + e.destination.id;
       this.nativeLayer_.startForceOpenNewTab(devicesUrl);
       this.destinationStore_.waitForRegister(e.destination.id);
     },

    /**
     * Consume escape key presses and ctrl + shift + p. Delegate everything else
     * to the preview area.
     * @param {KeyboardEvent} e The keyboard event.
     * @private
     * @suppress {uselessCode}
     * Current compiler preprocessor leaves all the code inside all the <if>s,
     * so the compiler claims that code after first return is unreachable.
     */
    onKeyDown_: function(e) {
      // Escape key closes the dialog.
      if (e.keyCode == 27 && !e.shiftKey && !e.ctrlKey && !e.altKey &&
          !e.metaKey) {
        // On non-mac with toolkit-views, ESC key is handled by C++-side instead
        // of JS-side.
        if (cr.isMac) {
          this.close_();
          e.preventDefault();
        }
        return;
      }

      // On Mac, Cmd-. should close the print dialog.
      if (cr.isMac && e.keyCode == 190 && e.metaKey) {
        this.close_();
        e.preventDefault();
        return;
      }

      // Ctrl + Shift + p / Mac equivalent.
      if (e.keyCode == 80) {
        if ((cr.isMac && e.metaKey && e.altKey && !e.shiftKey && !e.ctrlKey) ||
            (!cr.isMac && e.shiftKey && e.ctrlKey && !e.altKey && !e.metaKey)) {
          this.openSystemPrintDialog_();
          e.preventDefault();
          return;
        }
      }

      if (e.keyCode == 13 /*enter*/ &&
          !document.querySelector('.overlay:not([hidden])') &&
          this.destinationStore_.selectedDestination &&
          this.printTicketStore_.isTicketValid() &&
          this.printHeader_.isPrintButtonEnabled) {
        assert(this.uiState_ == PrintPreview.UiState_.READY,
            'Trying to print when not in ready state: ' + this.uiState_);
        var activeElementTag = document.activeElement.tagName.toUpperCase();
        if (activeElementTag != 'BUTTON' && activeElementTag != 'SELECT' &&
            activeElementTag != 'A') {
          this.printDocumentOrOpenPdfPreview_(false /*isPdfPreview*/);
          e.preventDefault();
        }
        return;
      }

      // Pass certain directional keyboard events to the PDF viewer.
      this.previewArea_.handleDirectionalKeyEvent(e);
    },

    /**
     * Called when native layer receives invalid settings for a print request.
     * @private
     */
    onSettingsInvalid_: function() {
      this.uiState_ = PrintPreview.UiState_.ERROR;
      console.error('Invalid settings error reported from native layer');
      this.previewArea_.showCustomMessage(
          loadTimeData.getString('invalidPrinterSettings'));
    },

    /**
     * Called when the destination settings' change button is activated.
     * Displays the destination search component.
     * @private
     */
    onDestinationChangeButtonActivate_: function() {
      this.destinationSearch_.setIsVisible(true);
    },

    /**
     * Called when the destination settings' change button is activated.
     * Displays the destination search component.
     * @private
     */
    onAdvancedOptionsButtonActivated_: function() {
      this.advancedSettings_.showForDestination(
          assert(this.destinationStore_.selectedDestination));
    },

    /**
     * Called when the destination search dispatches manage cloud destinations
     * event. Calls corresponding native layer method.
     * @private
     */
    onManageCloudDestinationsActivated_: function() {
      this.nativeLayer_.startManageCloudDestinations(this.userInfo_.activeUser);
    },

    /**
     * Called when the destination search dispatches manage local destinations
     * event. Calls corresponding native layer method.
     * @private
     */
    onManageLocalDestinationsActivated_: function() {
      this.nativeLayer_.startManageLocalDestinations();
    },

    /**
     * Called when the user wants to sign in to Google Cloud Print. Calls the
     * corresponding native layer event.
     * @param {boolean} addAccount Whether to open an 'add a new account' or
     *     default sign in page.
     * @private
     */
    onCloudPrintSignInActivated_: function(addAccount) {
      this.nativeLayer_.startCloudPrintSignIn(addAccount);
    },

    /**
     * Updates printing options according to source document presets.
     * @param {Event} event Contains options from source document.
     * @private
     */
    onPrintPresetOptionsFromDocument_: function(event) {
      if (event.optionsFromDocument.disableScaling)
        this.documentInfo_.updateIsScalingDisabled(true);

      if (event.optionsFromDocument.copies > 0 &&
          this.printTicketStore_.copies.isCapabilityAvailable()) {
        this.printTicketStore_.copies.updateValue(
            event.optionsFromDocument.copies);
      }

      if (event.optionsFromDocument.duplex >= 0 &&
          this.printTicketStore_.duplex.isCapabilityAvailable()) {
        this.printTicketStore_.duplex.updateValue(
            event.optionsFromDocument.duplex);
      }
    },

    /**
     * Called when privet printing fails.
     * @param {Event} event Event object representing the failure.
     * @private
     */
    onPrivetPrintFailed_: function(event) {
      console.error('Privet printing failed with error code ' +
                    event.httpError);
      this.printHeader_.setErrorMessage(
          loadTimeData.getString('couldNotPrint'));
    },

    /**
     * Called when the print preview settings need to be changed for testing.
     * @param {Event} event Event object that contains the option that is to
     *     be changed and what to set that option.
     * @private
     */
    onManipulateSettingsForTest_: function(event) {
      var settings =
          /** @type {print_preview.PreviewSettings} */(event.settings);
      if ('selectSaveAsPdfDestination' in settings) {
        this.saveAsPdfForTest_();  // No parameters.
      } else if ('layoutSettings' in settings) {
        this.setLayoutSettingsForTest_(settings.layoutSettings.portrait);
      } else if ('pageRange' in settings) {
        this.setPageRangeForTest_(settings.pageRange);
      } else if ('headersAndFooters' in settings) {
        this.setHeadersAndFootersForTest_(settings.headersAndFooters);
      } else if ('backgroundColorsAndImages' in settings) {
        this.setBackgroundColorsAndImagesForTest_(
            settings.backgroundColorsAndImages);
      } else if ('margins' in settings) {
        this.setMarginsForTest_(settings.margins);
      }
    },

    /**
     * Called by onManipulateSettingsForTest_(). Sets the print destination
     * as a pdf.
     * @private
     */
    saveAsPdfForTest_: function() {
      if (this.destinationStore_.selectedDestination &&
          print_preview.Destination.GooglePromotedId.SAVE_AS_PDF ==
          this.destinationStore_.selectedDestination.id) {
        this.nativeLayer_.previewReadyForTest();
        return;
      }

      var destinations = this.destinationStore_.destinations();
      var pdfDestination = null;
      for (var i = 0; i < destinations.length; i++) {
        if (destinations[i].id ==
            print_preview.Destination.GooglePromotedId.SAVE_AS_PDF) {
          pdfDestination = destinations[i];
          break;
        }
      }

      if (pdfDestination)
        this.destinationStore_.selectDestination(pdfDestination);
      else
        this.nativeLayer_.previewFailedForTest();
    },

    /**
     * Called by onManipulateSettingsForTest_(). Sets the layout settings to
     * either portrait or landscape.
     * @param {boolean} portrait Whether to use portrait page layout;
     *     if false: landscape.
     * @private
     */
    setLayoutSettingsForTest_: function(portrait) {
      var combobox = document.querySelector('.layout-settings-select');
      if (combobox.value == 'portrait') {
        this.nativeLayer_.previewReadyForTest();
      } else {
        combobox.value = 'landscape';
        this.layoutSettings_.onSelectChange_();
      }
    },

    /**
     * Called by onManipulateSettingsForTest_(). Sets the page range for
     * for the print preview settings.
     * @param {string} pageRange Sets the page range to the desired value(s).
     *     Ex: "1-5,9" means pages 1 through 5 and page 9 will be printed.
     * @private
     */
    setPageRangeForTest_: function(pageRange) {
      var textbox = document.querySelector('.page-settings-custom-input');
      if (textbox.value == pageRange) {
        this.nativeLayer_.previewReadyForTest();
      } else {
        textbox.value = pageRange;
        document.querySelector('.page-settings-custom-radio').click();
      }
    },

    /**
     * Called by onManipulateSettings_(). Checks or unchecks the headers and
     * footers option on print preview.
     * @param {boolean} headersAndFooters Whether the "Headers and Footers"
     *     checkbox should be checked.
     * @private
     */
    setHeadersAndFootersForTest_: function(headersAndFooters) {
      var checkbox = document.querySelector('.header-footer-checkbox');
      if (headersAndFooters == checkbox.checked)
        this.nativeLayer_.previewReadyForTest();
      else
        checkbox.click();
    },

    /**
     * Called by onManipulateSettings_(). Checks or unchecks the background
     * colors and images option on print preview.
     * @param {boolean} backgroundColorsAndImages If true, the checkbox should
     *     be checked. Otherwise it should be unchecked.
     * @private
     */
    setBackgroundColorsAndImagesForTest_: function(backgroundColorsAndImages) {
      var checkbox = document.querySelector('.css-background-checkbox');
      if (backgroundColorsAndImages == checkbox.checked)
        this.nativeLayer_.previewReadyForTest();
      else
        checkbox.click();
    },

    /**
     * Called by onManipulateSettings_(). Sets the margin settings
     * that are desired. Custom margin settings aren't currently supported.
     * @param {number} margins The desired margins combobox index. Must be
     *     a valid index or else the test fails.
     * @private
     */
    setMarginsForTest_: function(margins) {
      var combobox = document.querySelector('.margin-settings-select');
      if (margins == combobox.selectedIndex) {
        this.nativeLayer_.previewReadyForTest();
      } else if (margins >= 0 && margins < combobox.length) {
        combobox.selectedIndex = margins;
        this.marginSettings_.onSelectChange_();
      } else {
        this.nativeLayer_.previewFailedForTest();
      }
    },

    /**
     * Returns true if "Print using system dialog" link should be shown for
     * current destination.
     * @return {boolean} Returns true if link should be shown.
     */
    shouldShowSystemDialogLink_: function() {
      if (cr.isChromeOS || this.hideSystemDialogLink_)
        return false;
      if (!cr.isWindows)
        return true;
      var selectedDest = this.destinationStore_.selectedDestination;
      return !!selectedDest &&
             selectedDest.origin == print_preview.Destination.Origin.LOCAL &&
             selectedDest.id !=
                 print_preview.Destination.GooglePromotedId.SAVE_AS_PDF;
    },

    /**
     * Called when a print destination is selected. Shows/hides the "Print with
     * Cloud Print" link in the navbar.
     * @private
     */
    onDestinationSelect_: function() {
      if ($('system-dialog-link')) {
        setIsVisible($('system-dialog-link'),
                     this.shouldShowSystemDialogLink_());
      }
      if (this.destinationStore_.selectedDestination &&
          this.isInKioskAutoPrintMode_) {
        this.onPrintButtonClick_();
      }
    },

    /**
     * Called when the destination store loads a group of destinations. Shows
     * a promo on Chrome OS if the user has no print destinations promoting
     * Google Cloud Print.
     * @private
     */
    onDestinationSearchDone_: function() {
      var isPromoVisible = cr.isChromeOS &&
          this.cloudPrintInterface_ &&
          this.userInfo_.activeUser &&
          !this.appState_.isGcpPromoDismissed &&
          !this.destinationStore_.isLocalDestinationSearchInProgress &&
          !this.destinationStore_.isCloudDestinationSearchInProgress &&
          this.destinationStore_.hasOnlyDefaultCloudDestinations();
      setIsVisible(this.getChildElement('#no-destinations-promo'),
                   isPromoVisible);
      if (isPromoVisible) {
        new print_preview.GcpPromoMetricsContext().record(
            print_preview.Metrics.GcpPromoBucket.PROMO_SHOWN);
      }
    },

    /**
     * Called when the close button on the no-destinations-promotion is clicked.
     * Hides the promotion.
     * @private
     */
    onNoDestinationsPromoClose_: function() {
      new print_preview.GcpPromoMetricsContext().record(
          print_preview.Metrics.GcpPromoBucket.PROMO_CLOSED);
      setIsVisible(this.getChildElement('#no-destinations-promo'), false);
      this.appState_.persistIsGcpPromoDismissed(true);
    },

    /**
     * Called when the no-destinations promotion link is clicked. Opens the
     * Google Cloud Print management page and closes the print preview.
     * @private
     */
    onNoDestinationsPromoClick_: function() {
      new print_preview.GcpPromoMetricsContext().record(
          print_preview.Metrics.GcpPromoBucket.PROMO_CLICKED);
      this.appState_.persistIsGcpPromoDismissed(true);
      window.open(this.cloudPrintInterface_.baseUrl + '?user=' +
                  this.userInfo_.activeUser + '#printers');
      this.close_();
    }
  };

  // Export
  return {
    PrintPreview: PrintPreview
  };
});

// Pull in all other scripts in a single shot.
// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Modal dialog base component.
   * @param {!print_preview.MetricsContext} metricsContext Metrics
   *     context to record usage statistics.
   * @constructor
   * @extends {print_preview.Component}
   */
  function Overlay(metricsContext) {
    print_preview.Component.call(this);

    /** @private {!print_preview.MetricsContext} */
    this.metricsContext_ = metricsContext;
  };

  Overlay.prototype = {
    __proto__: print_preview.Component.prototype,

    /** @return {!print_preview.MetricsContext} */
    get metricsContext() {
      return this.metricsContext_;
    },

    /** @override */
    enterDocument: function() {
      print_preview.Component.prototype.enterDocument.call(this);

      this.getElement().addEventListener('webkitTransitionEnd', function f(e) {
        if (e.target == e.currentTarget && e.propertyName == 'opacity' &&
            e.target.classList.contains('transparent')) {
          setIsVisible(e.target, false);
        }
      });

      this.getElement().addEventListener('keydown', function f(e) {
        // Escape pressed -> cancel the dialog.
        if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
          if (e.keyCode == 27) {
            e.stopPropagation();
            e.preventDefault();
            this.cancel();
          } else if (e.keyCode == 13) {
            var activeElementTag = document.activeElement ?
                document.activeElement.tagName.toUpperCase() : '';
            if (activeElementTag != 'BUTTON' && activeElementTag != 'SELECT') {
              if (this.onEnterPressedInternal()) {
                e.stopPropagation();
                e.preventDefault();
              }
            }
          }
        }
      }.bind(this));

      this.tracker.add(
          this.getChildElement('.page > .close-button'),
          'click',
          this.cancel.bind(this));

      this.tracker.add(
          this.getElement(), 'click', this.onOverlayClick_.bind(this));
      this.tracker.add(
          this.getChildElement('.page'),
          'webkitAnimationEnd',
          this.onAnimationEnd_.bind(this));
    },

    /** @return {boolean} Whether the component is visible. */
    getIsVisible: function() {
      return !this.getElement().classList.contains('transparent');
    },

    /** @param {boolean} isVisible Whether the component is visible. */
    setIsVisible: function(isVisible) {
      if (this.getIsVisible() == isVisible)
        return;
      if (isVisible) {
        setIsVisible(this.getElement(), true);
        setTimeout(function(element) {
          element.classList.remove('transparent');
        }.bind(this, this.getElement()), 0);
      } else {
        this.getElement().classList.add('transparent');
      }
      this.onSetVisibleInternal(isVisible);
    },

    /** Closes the dialog. */
    cancel: function() {
      this.setIsVisible(false);
      this.onCancelInternal();
    },

    /**
     * @param {boolean} isVisible Whether the component is visible.
     * @protected
     */
    onSetVisibleInternal: function(isVisible) {},

    /** @protected */
    onCancelInternal: function() {},

    /**
     * @return {boolean} Whether the event was handled.
     * @protected
     */
    onEnterPressedInternal: function() {
      return false;
    },

    /**
     * Called when the overlay is clicked. Pulses the page.
     * @param {Event} e Contains the element that was clicked.
     * @private
     */
    onOverlayClick_: function(e) {
      if (e.target && e.target.classList.contains('overlay'))
        e.target.querySelector('.page').classList.add('pulse');
    },

    /**
     * Called when an animation ends on the page.
     * @param {Event} e Contains the target done animating.
     * @private
     */
    onAnimationEnd_: function(e) {
      if (e.target && e.animationName == 'pulse')
        e.target.classList.remove('pulse');
    }
  };

  // Export
  return {
    Overlay: Overlay
  };
});

// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Component that renders a search box for searching through destinations.
   * @param {string} searchBoxPlaceholderText Search box placeholder text.
   * @constructor
   * @extends {print_preview.Component}
   */
  function SearchBox(searchBoxPlaceholderText) {
    print_preview.Component.call(this);

    /**
     * Search box placeholder text.
     * @private {string}
     */
    this.searchBoxPlaceholderText_ = searchBoxPlaceholderText;

    /**
     * Timeout used to control incremental search.
     * @private {?number}
     */
     this.timeout_ = null;

    /**
     * Input box where the query is entered.
     * @private {HTMLInputElement}
     */
    this.input_ = null;
  };

  /**
   * Enumeration of event types dispatched from the search box.
   * @enum {string}
   */
  SearchBox.EventType = {
    SEARCH: 'print_preview.SearchBox.SEARCH'
  };

  /**
   * Delay in milliseconds before dispatching a SEARCH event.
   * @private {number}
   * @const
   */
  SearchBox.SEARCH_DELAY_ = 150;

  SearchBox.prototype = {
    __proto__: print_preview.Component.prototype,

    /** @param {?string} query New query to set the search box's query to. */
    setQuery: function(query) {
      query = query || '';
      this.input_.value = query.trim();
    },

    /** Sets the input element of the search box in focus. */
    focus: function() {
      this.input_.focus();
    },

    /** @override */
    createDom: function() {
      this.setElementInternal(this.cloneTemplateInternal(
          'search-box-template'));
      this.input_ = assertInstanceof(this.getChildElement('.search-box-input'),
          HTMLInputElement);
      this.input_.setAttribute('placeholder', this.searchBoxPlaceholderText_);
    },

    /** @override */
    enterDocument: function() {
      print_preview.Component.prototype.enterDocument.call(this);
      this.tracker.add(assert(this.input_), 'input',
                       this.onInputInput_.bind(this));
    },

    /** @override */
    exitDocument: function() {
      print_preview.Component.prototype.exitDocument.call(this);
      this.input_ = null;
    },

    /**
     * @return {string} The current query of the search box.
     * @private
     */
    getQuery_: function() {
      return this.input_.value.trim();
    },

    /**
     * Dispatches a SEARCH event.
     * @private
     */
    dispatchSearchEvent_: function() {
      this.timeout_ = null;
      var searchEvent = new Event(SearchBox.EventType.SEARCH);
      var query = this.getQuery_();
      searchEvent.query = query;
      if (query) {
        // Generate regexp-safe query by escaping metacharacters.
        var safeQuery = query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        searchEvent.queryRegExp = new RegExp('(' + safeQuery + ')', 'ig');
      } else {
        searchEvent.queryRegExp = null;
      }
      this.dispatchEvent(searchEvent);
    },

    /**
     * Called when the input element's value changes. Dispatches a search event.
     * @private
     */
    onInputInput_: function() {
      if (this.timeout_)
        clearTimeout(this.timeout_);
      this.timeout_ = setTimeout(
          this.dispatchSearchEvent_.bind(this), SearchBox.SEARCH_DELAY_);
    }
  };

  // Export
  return {
    SearchBox: SearchBox
  };
});

// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Encapsulated handling of a search bubble.
   * @constructor
   * @extends {HTMLDivElement}
   */
  function SearchBubble(text) {
    var el = cr.doc.createElement('div');
    SearchBubble.decorate(el);
    el.content = text;
    return el;
  }

  SearchBubble.decorate = function(el) {
    el.__proto__ = SearchBubble.prototype;
    el.decorate();
  };

  SearchBubble.prototype = {
    __proto__: HTMLDivElement.prototype,

    decorate: function() {
      this.className = 'search-bubble';

      this.innards_ = cr.doc.createElement('div');
      this.innards_.className = 'search-bubble-innards';
      this.appendChild(this.innards_);

      // We create a timer to periodically update the position of the bubbles.
      // While this isn't all that desirable, it's the only sure-fire way of
      // making sure the bubbles stay in the correct location as sections
      // may dynamically change size at any time.
      this.intervalId = setInterval(this.updatePosition.bind(this), 250);
    },

    /**
     * Sets the text message in the bubble.
     * @param {string} text The text the bubble will show.
     */
    set content(text) {
      this.innards_.textContent = text;
    },

    /** Attach the bubble to the element. */
    attachTo: function(element) {
      var parent = element.parentElement;
      if (!parent)
        return;
      if (parent.tagName == 'TD') {
        // To make absolute positioning work inside a table cell we need
        // to wrap the bubble div into another div with position:relative.
        // This only works properly if the element is the first child of the
        // table cell which is true for all options pages (the only place
        // it is used on tables).
        this.wrapper = cr.doc.createElement('div');
        this.wrapper.className = 'search-bubble-wrapper';
        this.wrapper.appendChild(this);
        parent.insertBefore(this.wrapper, element);
      } else {
        parent.insertBefore(this, element);
      }
      this.updatePosition();
    },

    /** Clear the interval timer and remove the element from the page. */
    dispose: function() {
      clearInterval(this.intervalId);

      var child = this.wrapper || this;
      var parent = child.parentNode;
      if (parent)
        parent.removeChild(child);
    },

    /**
     * Update the position of the bubble. Called at creation time and then
     * periodically while the bubble remains visible.
     */
    updatePosition: function() {
      // This bubble is 'owned' by the next sibling.
      var owner = (this.wrapper || this).nextSibling;

      // If there isn't an offset parent, we have nothing to do.
      if (!owner.offsetParent)
        return;

      // Position the bubble below the location of the owner.
      var left = owner.offsetLeft + owner.offsetWidth / 2 -
          this.offsetWidth / 2;
      var top = owner.offsetTop + owner.offsetHeight;

      // Update the position in the CSS.  Cache the last values for
      // best performance.
      if (left != this.lastLeft) {
        this.style.left = left + 'px';
        this.lastLeft = left;
      }
      if (top != this.lastTop) {
        this.style.top = top + 'px';
        this.lastTop = top;
      }
    },
  };

  // Export
  return {
    SearchBubble: SearchBubble
  };
});


// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * An immutable ordered set of page numbers.
   * @param {!Array<number>} pageNumberList A list of page numbers to include
   *     in the set.
   * @constructor
   */
  function PageNumberSet(pageNumberList) {
    /**
     * Internal data store for the page number set.
     * @type {!Array<number>}
     * @private
     */
    this.pageNumberSet_ = pageListToPageSet(pageNumberList);
  };

  PageNumberSet.prototype = {
    /** @return {number} The number of page numbers in the set. */
    get size() {
      return this.pageNumberSet_.length;
    },

    /**
     * @param {number} index 0-based index of the page number to get.
     * @return {number} Page number at the given index.
     */
    getPageNumberAt: function(index) {
      return this.pageNumberSet_[index];
    },

    /**
     * @param {number} pageNumber 1-based page number to check for.
     * @return {boolean} Whether the given page number is in the page range.
     */
    hasPageNumber: function(pageNumber) {
      return arrayContains(this.pageNumberSet_, pageNumber);
    },

    /**
     * @param {number} pageNumber 1-based number of the page to get index of.
     * @return {number} 0-based index of the given page number with respect to
     *     all of the pages in the page range.
     */
    getPageNumberIndex: function(pageNumber) {
      return this.pageNumberSet_.indexOf(pageNumber);
    },

    /** @return {!Array<number>} Array representation of the set. */
    asArray: function() {
      return this.pageNumberSet_.slice(0);
    },
  };

  // Export
  return {
    PageNumberSet: PageNumberSet
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.exportPath('print_preview');

/**
 * The CDD (Cloud Device Description) describes the capabilities of a print
 * destination.
 *
 * @typedef {{
 *   version: string,
 *   printer: {
 *     vendor_capability: !Array<{Object}>,
 *     collate: ({default: (boolean|undefined)}|undefined),
 *     color: ({
 *       option: !Array<{
 *         type: (string|undefined),
 *         vendor_id: (string|undefined),
 *         custom_display_name: (string|undefined),
 *         is_default: (boolean|undefined)
 *       }>
 *     }|undefined),
 *     copies: ({default: (number|undefined),
 *               max: (number|undefined)}|undefined),
 *     duplex: ({option: !Array<{type: (string|undefined),
 *                               is_default: (boolean|undefined)}>}|undefined),
 *     page_orientation: ({
 *       option: !Array<{type: (string|undefined),
 *                        is_default: (boolean|undefined)}>
 *     }|undefined)
 *   }
 * }}
 */
print_preview.Cdd;

cr.define('print_preview', function() {
  'use strict';

  /**
   * Print destination data object that holds data for both local and cloud
   * destinations.
   * @param {string} id ID of the destination.
   * @param {!print_preview.Destination.Type} type Type of the destination.
   * @param {!print_preview.Destination.Origin} origin Origin of the
   *     destination.
   * @param {string} displayName Display name of the destination.
   * @param {boolean} isRecent Whether the destination has been used recently.
   * @param {!print_preview.Destination.ConnectionStatus} connectionStatus
   *     Connection status of the print destination.
   * @param {{tags: (Array<string>|undefined),
   *          isOwned: (boolean|undefined),
   *          account: (string|undefined),
   *          lastAccessTime: (number|undefined),
   *          isTosAccepted: (boolean|undefined),
   *          cloudID: (string|undefined),
   *          provisionalType:
   *              (print_preview.Destination.ProvisionalType|undefined),
   *          extensionId: (string|undefined),
   *          extensionName: (string|undefined),
   *          description: (string|undefined)}=} opt_params Optional parameters
   *     for the destination.
   * @constructor
   */
  function Destination(id, type, origin, displayName, isRecent,
                       connectionStatus, opt_params) {
    /**
     * ID of the destination.
     * @private {string}
     */
    this.id_ = id;

    /**
     * Type of the destination.
     * @private {!print_preview.Destination.Type}
     */
    this.type_ = type;

    /**
     * Origin of the destination.
     * @private {!print_preview.Destination.Origin}
     */
    this.origin_ = origin;

    /**
     * Display name of the destination.
     * @private {string}
     */
    this.displayName_ = displayName || '';

    /**
     * Whether the destination has been used recently.
     * @private {boolean}
     */
    this.isRecent_ = isRecent;

    /**
     * Tags associated with the destination.
     * @private {!Array<string>}
     */
    this.tags_ = (opt_params && opt_params.tags) || [];

    /**
     * Print capabilities of the destination.
     * @private {?print_preview.Cdd}
     */
    this.capabilities_ = null;

    /**
     * Whether the destination is owned by the user.
     * @private {boolean}
     */
    this.isOwned_ = (opt_params && opt_params.isOwned) || false;

    /**
     * Account this destination is registered for, if known.
     * @private {string}
     */
    this.account_ = (opt_params && opt_params.account) || '';

    /**
     * Cache of destination location fetched from tags.
     * @private {?string}
     */
    this.location_ = null;

    /**
     * Printer description.
     * @private {string}
     */
    this.description_ = (opt_params && opt_params.description) || '';

    /**
     * Connection status of the destination.
     * @private {!print_preview.Destination.ConnectionStatus}
     */
    this.connectionStatus_ = connectionStatus;

    /**
     * Number of milliseconds since the epoch when the printer was last
     * accessed.
     * @private {number}
     */
    this.lastAccessTime_ = (opt_params && opt_params.lastAccessTime) ||
                           Date.now();

    /**
     * Whether the user has accepted the terms-of-service for the print
     * destination. Only applies to the FedEx Office cloud-based printer.
     * {@code null} if terms-of-service does not apply to the print destination.
     * @private {?boolean}
     */
    this.isTosAccepted_ = !!(opt_params && opt_params.isTosAccepted);

    /**
     * Cloud ID for Privet printers.
     * @private {string}
     */
    this.cloudID_ = (opt_params && opt_params.cloudID) || '';

    /**
     * Extension ID for extension managed printers.
     * @private {string}
     */
    this.extensionId_ = (opt_params && opt_params.extensionId) || '';

    /**
     * Extension name for extension managed printers.
     * @private {string}
     */
    this.extensionName_ = (opt_params && opt_params.extensionName) || '';

    /**
     * Different from {@code Destination.ProvisionalType.NONE} if the
     * destination is provisional. Provisional destinations cannot be selected
     * as they are, but have to be resolved first (i.e. extra steps have to be
     * taken to get actual destination properties, which should replace the
     * provisional ones). Provisional destination resolvment flow will be
     * started when the user attempts to select the destination in search UI.
     * @private {Destination.ProvisionalType}
     */
    this.provisionalType_ = (opt_params && opt_params.provisionalType) ||
                            Destination.ProvisionalType.NONE;

    assert(this.provisionalType_ !=
               Destination.ProvisionalType.NEEDS_USB_PERMISSON ||
           this.isExtension,
           'Provisional USB destination only supprted with extension origin.');
  };

  /**
   * Prefix of the location destination tag.
   * @type {!Array<string>}
   * @const
   */
  Destination.LOCATION_TAG_PREFIXES = [
    '__cp__location=',
    '__cp__printer-location='
  ];

  /**
   * Enumeration of Google-promoted destination IDs.
   * @enum {string}
   */
  Destination.GooglePromotedId = {
    DOCS: '__google__docs',
    FEDEX: '__google__fedex',
    SAVE_AS_PDF: 'Save as PDF'
  };

  /**
   * Enumeration of the types of destinations.
   * @enum {string}
   */
  Destination.Type = {
    GOOGLE: 'google',
    GOOGLE_PROMOTED: 'google_promoted',
    LOCAL: 'local',
    MOBILE: 'mobile'
  };

  /**
   * Enumeration of the origin types for cloud destinations.
   * @enum {string}
   */
  Destination.Origin = {
    LOCAL: 'local',
    COOKIES: 'cookies',
    PROFILE: 'profile',
    DEVICE: 'device',
    PRIVET: 'privet',
    EXTENSION: 'extension'
  };

  /**
   * Enumeration of the connection statuses of printer destinations.
   * @enum {string}
   */
  Destination.ConnectionStatus = {
    DORMANT: 'DORMANT',
    OFFLINE: 'OFFLINE',
    ONLINE: 'ONLINE',
    UNKNOWN: 'UNKNOWN',
    UNREGISTERED: 'UNREGISTERED'
  };

  /**
   * Enumeration specifying whether a destination is provisional and the reason
   * the destination is provisional.
   * @enum {string
   */
  Destination.ProvisionalType = {
    /** Destination is not provisional. */
    NONE: 'NONE',
    /**
     * User has to grant USB access for the destination to its provider.
     * Used for destinations with extension origin.
     */
    NEEDS_USB_PERMISSION: 'NEEDS_USB_PERMISSION'
  };

  /**
   * Enumeration of relative icon URLs for various types of destinations.
   * @enum {string}
   * @private
   */
  Destination.IconUrl_ = {
    CLOUD: 'images/printer.png',
    CLOUD_SHARED: 'images/printer_shared.png',
    LOCAL: 'images/printer.png',
    MOBILE: 'images/mobile.png',
    MOBILE_SHARED: 'images/mobile_shared.png',
    THIRD_PARTY: 'images/third_party.png',
    PDF: 'images/pdf.png',
    DOCS: 'images/google_doc.png',
    FEDEX: 'images/third_party_fedex.png'
  };

  Destination.prototype = {
    /** @return {string} ID of the destination. */
    get id() {
      return this.id_;
    },

    /** @return {!print_preview.Destination.Type} Type of the destination. */
    get type() {
      return this.type_;
    },

    /**
     * @return {!print_preview.Destination.Origin} Origin of the destination.
     */
    get origin() {
      return this.origin_;
    },

    /** @return {string} Display name of the destination. */
    get displayName() {
      return this.displayName_;
    },

    /** @return {boolean} Whether the destination has been used recently. */
    get isRecent() {
      return this.isRecent_;
    },

    /**
     * @param {boolean} isRecent Whether the destination has been used recently.
     */
    set isRecent(isRecent) {
      this.isRecent_ = isRecent;
    },

    /**
     * @return {boolean} Whether the user owns the destination. Only applies to
     *     cloud-based destinations.
     */
    get isOwned() {
      return this.isOwned_;
    },

    /**
     * @return {string} Account this destination is registered for, if known.
     */
    get account() {
      return this.account_;
    },

    /** @return {boolean} Whether the destination is local or cloud-based. */
    get isLocal() {
      return this.origin_ == Destination.Origin.LOCAL ||
             this.origin_ == Destination.Origin.EXTENSION ||
             (this.origin_ == Destination.Origin.PRIVET &&
              this.connectionStatus_ !=
              Destination.ConnectionStatus.UNREGISTERED);
    },

    /** @return {boolean} Whether the destination is a Privet local printer */
    get isPrivet() {
      return this.origin_ == Destination.Origin.PRIVET;
    },

    /**
     * @return {boolean} Whether the destination is an extension managed
     *     printer.
     */
    get isExtension() {
      return this.origin_ == Destination.Origin.EXTENSION;
    },

    /**
     * @return {string} The location of the destination, or an empty string if
     *     the location is unknown.
     */
    get location() {
      if (this.location_ == null) {
        this.location_ = '';
        this.tags_.some(function(tag) {
          return Destination.LOCATION_TAG_PREFIXES.some(function(prefix) {
            if (tag.startsWith(prefix)) {
              this.location_ = tag.substring(prefix.length) || '';
              return true;
            }
          }, this);
        }, this);
      }
      return this.location_;
    },

    /**
     * @return {string} The description of the destination, or an empty string,
     *     if it was not provided.
     */
    get description() {
      return this.description_;
    },

    /**
     * @return {string} Most relevant string to help user to identify this
     *     destination.
     */
    get hint() {
      if (this.id_ == Destination.GooglePromotedId.DOCS ||
          this.id_ == Destination.GooglePromotedId.FEDEX) {
        return this.account_;
      }
      return this.location || this.extensionName || this.description;
    },

    /** @return {!Array<string>} Tags associated with the destination. */
    get tags() {
      return this.tags_.slice(0);
    },

    /** @return {string} Cloud ID associated with the destination */
    get cloudID() {
      return this.cloudID_;
    },

    /**
     * @return {string} Extension ID associated with the destination. Non-empty
     *     only for extension managed printers.
     */
    get extensionId() {
      return this.extensionId_;
    },

    /**
     * @return {string} Extension name associated with the destination.
     *     Non-empty only for extension managed printers.
     */
    get extensionName() {
      return this.extensionName_;
    },

    /** @return {?print_preview.Cdd} Print capabilities of the destination. */
    get capabilities() {
      return this.capabilities_;
    },

    /**
     * @param {!print_preview.Cdd} capabilities Print capabilities of the
     *     destination.
     */
    set capabilities(capabilities) {
      this.capabilities_ = capabilities;
    },

    /**
     * @return {!print_preview.Destination.ConnectionStatus} Connection status
     *     of the print destination.
     */
    get connectionStatus() {
      return this.connectionStatus_;
    },

    /**
     * @param {!print_preview.Destination.ConnectionStatus} status Connection
     *     status of the print destination.
     */
    set connectionStatus(status) {
      this.connectionStatus_ = status;
    },

    /** @return {boolean} Whether the destination is considered offline. */
    get isOffline() {
      return arrayContains([print_preview.Destination.ConnectionStatus.OFFLINE,
                            print_preview.Destination.ConnectionStatus.DORMANT],
                            this.connectionStatus_);
    },

    /** @return {string} Human readable status for offline destination. */
    get offlineStatusText() {
      if (!this.isOffline) {
        return '';
      }
      var offlineDurationMs = Date.now() - this.lastAccessTime_;
      var offlineMessageId;
      if (offlineDurationMs > 31622400000.0) {  // One year.
        offlineMessageId = 'offlineForYear';
      } else if (offlineDurationMs > 2678400000.0) {  // One month.
        offlineMessageId = 'offlineForMonth';
      } else if (offlineDurationMs > 604800000.0) {  // One week.
        offlineMessageId = 'offlineForWeek';
      } else {
        offlineMessageId = 'offline';
      }
      return loadTimeData.getString(offlineMessageId);
    },

    /**
     * @return {number} Number of milliseconds since the epoch when the printer
     *     was last accessed.
     */
    get lastAccessTime() {
      return this.lastAccessTime_;
    },

    /** @return {string} Relative URL of the destination's icon. */
    get iconUrl() {
      if (this.id_ == Destination.GooglePromotedId.DOCS) {
        return Destination.IconUrl_.DOCS;
      } else if (this.id_ == Destination.GooglePromotedId.FEDEX) {
        return Destination.IconUrl_.FEDEX;
      } else if (this.id_ == Destination.GooglePromotedId.SAVE_AS_PDF) {
        return Destination.IconUrl_.PDF;
      } else if (this.isLocal) {
        return Destination.IconUrl_.LOCAL;
      } else if (this.type_ == Destination.Type.MOBILE && this.isOwned_) {
        return Destination.IconUrl_.MOBILE;
      } else if (this.type_ == Destination.Type.MOBILE) {
        return Destination.IconUrl_.MOBILE_SHARED;
      } else if (this.isOwned_) {
        return Destination.IconUrl_.CLOUD;
      } else {
        return Destination.IconUrl_.CLOUD_SHARED;
      }
    },

    /**
     * @return {?boolean} Whether the user has accepted the terms-of-service of
     *     the print destination or {@code null} if a terms-of-service does not
     *     apply.
     */
    get isTosAccepted() {
      return this.isTosAccepted_;
    },

    /**
     * @param {?boolean} isTosAccepted Whether the user has accepted the
     *     terms-of-service of the print destination or {@code null} if
     *     a terms-of-service does not apply.
     */
    set isTosAccepted(isTosAccepted) {
      this.isTosAccepted_ = isTosAccepted;
    },

    /**
     * @return {!Array<string>} Properties (besides display name) to match
     *     search queries against.
     */
    get extraPropertiesToMatch() {
      return [this.location, this.description];
    },

    /**
     * Matches a query against the destination.
     * @param {!RegExp} query Query to match against the destination.
     * @return {boolean} {@code true} if the query matches this destination,
     *     {@code false} otherwise.
     */
    matches: function(query) {
      return !!this.displayName_.match(query) ||
          !!this.extensionName_.match(query) ||
          this.extraPropertiesToMatch.some(function(property) {
            return property.match(query);
          });
    },

    /**
     * Gets the destination's provisional type.
     * @return {Destination.ProvisionalType}
     */
    get provisionalType() {
      return this.provisionalType_;
    },

    /**
     * Whether the destinaion is provisional.
     * @return {boolean}
     */
    get isProvisional() {
      return this.provisionalType_ != Destination.ProvisionalType.NONE;
    }
  };

  // Export
  return {
    Destination: Destination,
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /** Namespace that contains a method to parse local print destinations. */
  function LocalDestinationParser() {};

  /**
   * Parses a local print destination.
   * @param {!Object} destinationInfo Information describing a local print
   *     destination.
   * @return {!print_preview.Destination} Parsed local print destination.
   */
  LocalDestinationParser.parse = function(destinationInfo) {
    var options = {'description': destinationInfo.printerDescription};
    if (destinationInfo.printerOptions) {
      // Convert options into cloud print tags format.
      options.tags = Object.keys(destinationInfo.printerOptions).map(
          function(key) {return '__cp__' + key + '=' + this[key];},
          destinationInfo.printerOptions);
    }
    return new print_preview.Destination(
        destinationInfo.deviceName,
        print_preview.Destination.Type.LOCAL,
        print_preview.Destination.Origin.LOCAL,
        destinationInfo.printerName,
        false /*isRecent*/,
        print_preview.Destination.ConnectionStatus.ONLINE,
        options);
  };

  function PrivetDestinationParser() {}

  /**
   * Parses a privet destination as one or more local printers.
   * @param {!Object} destinationInfo Object that describes a privet printer.
   * @return {!Array<!print_preview.Destination>} Parsed destination info.
   */
  PrivetDestinationParser.parse = function(destinationInfo) {
    var returnedPrinters = [];

    if (destinationInfo.hasLocalPrinting) {
       returnedPrinters.push(new print_preview.Destination(
           destinationInfo.serviceName,
           print_preview.Destination.Type.LOCAL,
           print_preview.Destination.Origin.PRIVET,
           destinationInfo.name,
           false /*isRecent*/,
           print_preview.Destination.ConnectionStatus.ONLINE,
           { cloudID: destinationInfo.cloudID }));
    }

    if (destinationInfo.isUnregistered) {
      returnedPrinters.push(new print_preview.Destination(
          destinationInfo.serviceName,
          print_preview.Destination.Type.GOOGLE,
          print_preview.Destination.Origin.PRIVET,
          destinationInfo.name,
          false /*isRecent*/,
          print_preview.Destination.ConnectionStatus.UNREGISTERED));
    }

    return returnedPrinters;
  };

  function ExtensionDestinationParser() {}

  /**
   * Parses an extension destination from an extension supplied printer
   * description.
   * @param {!Object} destinationInfo Object describing an extension printer.
   * @return {!print_preview.Destination} Parsed destination.
   */
  ExtensionDestinationParser.parse = function(destinationInfo) {
    var provisionalType =
        destinationInfo.provisional ?
            print_preview.Destination.ProvisionalType.NEEDS_USB_PERMISSION :
            print_preview.Destination.ProvisionalType.NONE;

    return new print_preview.Destination(
        destinationInfo.id,
        print_preview.Destination.Type.LOCAL,
        print_preview.Destination.Origin.EXTENSION,
        destinationInfo.name,
        false /* isRecent */,
        print_preview.Destination.ConnectionStatus.ONLINE,
        {description: destinationInfo.description || '',
         extensionId: destinationInfo.extensionId,
         extensionName: destinationInfo.extensionName || '',
         provisionalType: provisionalType});
  };

  // Export
  return {
    LocalDestinationParser: LocalDestinationParser,
    PrivetDestinationParser: PrivetDestinationParser,
    ExtensionDestinationParser: ExtensionDestinationParser
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('cloudprint', function() {
  'use strict';

  /** Namespace which contains a method to parse cloud destinations directly. */
  function CloudDestinationParser() {};

  /**
   * Enumeration of cloud destination field names.
   * @enum {string}
   * @private
   */
  CloudDestinationParser.Field_ = {
    CAPABILITIES: 'capabilities',
    CONNECTION_STATUS: 'connectionStatus',
    DESCRIPTION: 'description',
    DISPLAY_NAME: 'displayName',
    ID: 'id',
    IS_TOS_ACCEPTED: 'isTosAccepted',
    LAST_ACCESS: 'accessTime',
    TAGS: 'tags',
    TYPE: 'type'
  };

  /**
   * Special tag that denotes whether the destination has been recently used.
   * @type {string}
   * @const
   * @private
   */
  CloudDestinationParser.RECENT_TAG_ = '^recent';

  /**
   * Special tag that denotes whether the destination is owned by the user.
   * @type {string}
   * @const
   * @private
   */
  CloudDestinationParser.OWNED_TAG_ = '^own';

  /**
   * Enumeration of cloud destination types that are supported by print preview.
   * @enum {string}
   * @private
   */
  CloudDestinationParser.CloudType_ = {
    ANDROID: 'ANDROID_CHROME_SNAPSHOT',
    DOCS: 'DOCS',
    IOS: 'IOS_CHROME_SNAPSHOT'
  };

  /**
   * Parses a destination from JSON from a Google Cloud Print search or printer
   * response.
   * @param {!Object} json Object that represents a Google Cloud Print search or
   *     printer response.
   * @param {!print_preview.Destination.Origin} origin The origin of the
   *     response.
   * @param {string} account The account this destination is registered for or
   *     empty string, if origin != COOKIES.
   * @return {!print_preview.Destination} Parsed destination.
   */
  CloudDestinationParser.parse = function(json, origin, account) {
    if (!json.hasOwnProperty(CloudDestinationParser.Field_.ID) ||
        !json.hasOwnProperty(CloudDestinationParser.Field_.TYPE) ||
        !json.hasOwnProperty(CloudDestinationParser.Field_.DISPLAY_NAME)) {
      throw Error('Cloud destination does not have an ID or a display name');
    }
    var id = json[CloudDestinationParser.Field_.ID];
    var tags = json[CloudDestinationParser.Field_.TAGS] || [];
    var connectionStatus =
        json[CloudDestinationParser.Field_.CONNECTION_STATUS] ||
        print_preview.Destination.ConnectionStatus.UNKNOWN;
    var optionalParams = {
      account: account,
      tags: tags,
      isOwned: arrayContains(tags, CloudDestinationParser.OWNED_TAG_),
      lastAccessTime: parseInt(
          json[CloudDestinationParser.Field_.LAST_ACCESS], 10) || Date.now(),
      isTosAccepted: (id == print_preview.Destination.GooglePromotedId.FEDEX) ?
          json[CloudDestinationParser.Field_.IS_TOS_ACCEPTED] : null,
      cloudID: id,
      description: json[CloudDestinationParser.Field_.DESCRIPTION]
    };
    var cloudDest = new print_preview.Destination(
        id,
        CloudDestinationParser.parseType_(
            json[CloudDestinationParser.Field_.TYPE]),
        origin,
        json[CloudDestinationParser.Field_.DISPLAY_NAME],
        arrayContains(tags, CloudDestinationParser.RECENT_TAG_) /*isRecent*/,
        connectionStatus,
        optionalParams);
    if (json.hasOwnProperty(CloudDestinationParser.Field_.CAPABILITIES)) {
      cloudDest.capabilities = /** @type {!print_preview.Cdd} */(
          json[CloudDestinationParser.Field_.CAPABILITIES]);
    }
    return cloudDest;
  };

  /**
   * Parses the destination type.
   * @param {string} typeStr Destination type given by the Google Cloud Print
   *     server.
   * @return {!print_preview.Destination.Type} Destination type.
   * @private
   */
  CloudDestinationParser.parseType_ = function(typeStr) {
    if (typeStr == CloudDestinationParser.CloudType_.ANDROID ||
        typeStr == CloudDestinationParser.CloudType_.IOS) {
      return print_preview.Destination.Type.MOBILE;
    } else if (typeStr == CloudDestinationParser.CloudType_.DOCS) {
      return print_preview.Destination.Type.GOOGLE_PROMOTED;
    } else {
      return print_preview.Destination.Type.GOOGLE;
    }
  };

  /** Namespace which contains a method to parse printer sharing invitation. */
  function InvitationParser() {};

  /**
   * Enumeration of invitation field names.
   * @enum {string}
   * @private
   */
  InvitationParser.Field_ = {
    PRINTER: 'printer',
    RECEIVER: 'receiver',
    SENDER: 'sender'
  };

  /**
   * Enumeration of cloud destination types that are supported by print preview.
   * @enum {string}
   * @private
   */
  InvitationParser.AclType_ = {
    DOMAIN: 'DOMAIN',
    GROUP: 'GROUP',
    PUBLIC: 'PUBLIC',
    USER: 'USER'
  };

  /**
   * Parses printer sharing invitation from JSON from GCP invite API response.
   * @param {!Object} json Object that represents a invitation search response.
   * @param {string} account The account this invitation is sent for.
   * @return {!print_preview.Invitation} Parsed invitation.
   */
  InvitationParser.parse = function(json, account) {
    if (!json.hasOwnProperty(InvitationParser.Field_.SENDER) ||
        !json.hasOwnProperty(InvitationParser.Field_.RECEIVER) ||
        !json.hasOwnProperty(InvitationParser.Field_.PRINTER)) {
      throw Error('Invitation does not have necessary info.');
    }

    var nameFormatter = function(name, scope) {
      return name && scope ? (name + ' (' + scope + ')') : (name || scope);
    };

    var sender = json[InvitationParser.Field_.SENDER];
    var senderName = nameFormatter(sender['name'], sender['email']);

    var receiver = json[InvitationParser.Field_.RECEIVER];
    var receiverName = '';
    var receiverType = receiver['type'];
    if (receiverType == InvitationParser.AclType_.USER) {
      // It's a personal invitation, empty name indicates just that.
    } else if (receiverType == InvitationParser.AclType_.GROUP ||
               receiverType == InvitationParser.AclType_.DOMAIN) {
      receiverName = nameFormatter(receiver['name'], receiver['scope']);
    } else {
      throw Error('Invitation of unsupported receiver type');
    }

    var destination = cloudprint.CloudDestinationParser.parse(
        json[InvitationParser.Field_.PRINTER],
        print_preview.Destination.Origin.COOKIES,
        account);

    return new print_preview.Invitation(
        senderName, receiverName, destination, receiver, account);
  };

  // Export
  return {
    CloudDestinationParser: CloudDestinationParser,
    InvitationParser: InvitationParser
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * A data store that stores destinations and dispatches events when the data
   * store changes.
   * @param {!Array<!print_preview.Destination.Origin>} origins Match
   *     destinations from these origins.
   * @param {RegExp} idRegExp Match destination's id.
   * @param {RegExp} displayNameRegExp Match destination's displayName.
   * @param {boolean} skipVirtualDestinations Whether to ignore virtual
   *     destinations, for example, Save as PDF.
   * @constructor
   */
  function DestinationMatch(
      origins, idRegExp, displayNameRegExp, skipVirtualDestinations) {

    /** @private {!Array<!print_preview.Destination.Origin>} */
    this.origins_ = origins;

    /** @private {RegExp} */
    this.idRegExp_ = idRegExp;

    /** @private {RegExp} */
    this.displayNameRegExp_ = displayNameRegExp;

    /** @private {boolean} */
    this.skipVirtualDestinations_ = skipVirtualDestinations;
  };

  DestinationMatch.prototype = {

    /**
     * @param {!print_preview.Destination.Origin} origin Origin to match.
     * @return {boolean} Whether the origin is one of the {@code origins_}.
     */
    matchOrigin: function(origin) {
      return arrayContains(this.origins_, origin);
    },

    /**
     * @param {string} id Id of the destination.
     * @param {string} origin Origin of the destination.
     * @return {boolean} Whether destination is the same as initial.
     */
    matchIdAndOrigin: function(id, origin) {
      return this.matchOrigin(origin) &&
             this.idRegExp_ &&
             this.idRegExp_.test(id);
    },

    /**
     * @param {!print_preview.Destination} destination Destination to match.
     * @return {boolean} Whether {@code destination} matches the last user
     *     selected one.
     */
    match: function(destination) {
      if (!this.matchOrigin(destination.origin)) {
        return false;
      }
      if (this.idRegExp_ && !this.idRegExp_.test(destination.id)) {
        return false;
      }
      if (this.displayNameRegExp_ &&
          !this.displayNameRegExp_.test(destination.displayName)) {
        return false;
      }
      if (this.skipVirtualDestinations_ &&
          this.isVirtualDestination_(destination)) {
        return false;
      }
      return true;
    },

    /**
     * @param {!print_preview.Destination} destination Destination to check.
     * @return {boolean} Whether {@code destination} is virtual, in terms of
     *     destination selection.
     * @private
     */
    isVirtualDestination_: function(destination) {
      if (destination.origin == print_preview.Destination.Origin.LOCAL) {
        return arrayContains(
            [print_preview.Destination.GooglePromotedId.SAVE_AS_PDF],
            destination.id);
      }
      return arrayContains(
          [print_preview.Destination.GooglePromotedId.DOCS,
           print_preview.Destination.GooglePromotedId.FEDEX],
          destination.id);
    }
  };

  /**
   * A data store that stores destinations and dispatches events when the data
   * store changes.
   * @param {!print_preview.NativeLayer} nativeLayer Used to fetch local print
   *     destinations.
   * @param {!print_preview.UserInfo} userInfo User information repository.
   * @param {!print_preview.AppState} appState Application state.
   * @constructor
   * @extends {cr.EventTarget}
   */
  function DestinationStore(nativeLayer, userInfo, appState) {
    cr.EventTarget.call(this);

    /**
     * Used to fetch local print destinations.
     * @type {!print_preview.NativeLayer}
     * @private
     */
    this.nativeLayer_ = nativeLayer;

    /**
     * User information repository.
     * @type {!print_preview.UserInfo}
     * @private
     */
    this.userInfo_ = userInfo;

    /**
     * Used to load and persist the selected destination.
     * @type {!print_preview.AppState}
     * @private
     */
    this.appState_ = appState;

    /**
     * Used to track metrics.
     * @type {!print_preview.DestinationSearchMetricsContext}
     * @private
     */
    this.metrics_ = new print_preview.DestinationSearchMetricsContext();

    /**
     * Internal backing store for the data store.
     * @type {!Array<!print_preview.Destination>}
     * @private
     */
    this.destinations_ = [];

    /**
     * Cache used for constant lookup of destinations by origin and id.
     * @type {Object<!print_preview.Destination>}
     * @private
     */
    this.destinationMap_ = {};

    /**
     * Currently selected destination.
     * @type {print_preview.Destination}
     * @private
     */
    this.selectedDestination_ = null;

    /**
     * Whether the destination store will auto select the destination that
     * matches this set of parameters.
     * @type {print_preview.DestinationMatch}
     * @private
     */
    this.autoSelectMatchingDestination_ = null;

    /**
     * Event tracker used to track event listeners of the destination store.
     * @type {!EventTracker}
     * @private
     */
    this.tracker_ = new EventTracker();

    /**
     * Whether PDF printer is enabled. It's disabled, for example, in App Kiosk
     * mode.
     * @type {boolean}
     * @private
     */
    this.pdfPrinterEnabled_ = false;

    /**
     * ID of the system default destination.
     * @type {?string}
     * @private
     */
    this.systemDefaultDestinationId_ = null;

    /**
     * Used to fetch cloud-based print destinations.
     * @type {cloudprint.CloudPrintInterface}
     * @private
     */
    this.cloudPrintInterface_ = null;

    /**
     * Maps user account to the list of origins for which destinations are
     * already loaded.
     * @type {!Object<Array<print_preview.Destination.Origin>>}
     * @private
     */
    this.loadedCloudOrigins_ = {};

    /**
     * ID of a timeout after the initial destination ID is set. If no inserted
     * destination matches the initial destination ID after the specified
     * timeout, the first destination in the store will be automatically
     * selected.
     * @type {?number}
     * @private
     */
    this.autoSelectTimeout_ = null;

    /**
     * Whether a search for local destinations is in progress.
     * @type {boolean}
     * @private
     */
    this.isLocalDestinationSearchInProgress_ = false;

    /**
     * Whether the destination store has already loaded or is loading all local
     * destinations.
     * @type {boolean}
     * @private
     */
    this.hasLoadedAllLocalDestinations_ = false;

    /**
     * Whether a search for privet destinations is in progress.
     * @type {boolean}
     * @private
     */
    this.isPrivetDestinationSearchInProgress_ = false;

    /**
     * Whether the destination store has already loaded or is loading all privet
     * destinations.
     * @type {boolean}
     * @private
     */
    this.hasLoadedAllPrivetDestinations_ = false;

    /**
     * ID of a timeout after the start of a privet search to end that privet
     * search.
     * @type {?number}
     * @private
     */
    this.privetSearchTimeout_ = null;

    /**
     * Whether a search for extension destinations is in progress.
     * @type {boolean}
     * @private
     */
    this.isExtensionDestinationSearchInProgress_ = false;

    /**
     * Whether the destination store has already loaded all extension
     * destinations.
     * @type {boolean}
     * @private
     */
    this.hasLoadedAllExtensionDestinations_ = false;

    /**
     * ID of a timeout set at the start of an extension destination search. The
     * timeout ends the search.
     * @type {?number}
     * @private
     */
    this.extensionSearchTimeout_ = null;

    /**
     * MDNS service name of destination that we are waiting to register.
     * @type {?string}
     * @private
     */
    this.waitForRegisterDestination_ = null;

    this.addEventListeners_();
    this.reset_();
  };

  /**
   * Event types dispatched by the data store.
   * @enum {string}
   */
  DestinationStore.EventType = {
    DESTINATION_SEARCH_DONE:
        'print_preview.DestinationStore.DESTINATION_SEARCH_DONE',
    DESTINATION_SEARCH_STARTED:
        'print_preview.DestinationStore.DESTINATION_SEARCH_STARTED',
    DESTINATION_SELECT: 'print_preview.DestinationStore.DESTINATION_SELECT',
    DESTINATIONS_INSERTED:
        'print_preview.DestinationStore.DESTINATIONS_INSERTED',
    PROVISIONAL_DESTINATION_RESOLVED:
        'print_preview.DestinationStore.PROVISIONAL_DESTINATION_RESOLVED',
    CACHED_SELECTED_DESTINATION_INFO_READY:
        'print_preview.DestinationStore.CACHED_SELECTED_DESTINATION_INFO_READY',
    SELECTED_DESTINATION_CAPABILITIES_READY:
        'print_preview.DestinationStore.SELECTED_DESTINATION_CAPABILITIES_READY'
  };

  /**
   * Delay in milliseconds before the destination store ignores the initial
   * destination ID and just selects any printer (since the initial destination
   * was not found).
   * @type {number}
   * @const
   * @private
   */
  DestinationStore.AUTO_SELECT_TIMEOUT_ = 15000;

  /**
   * Amount of time spent searching for privet destination, in milliseconds.
   * @type {number}
   * @const
   * @private
   */
  DestinationStore.PRIVET_SEARCH_DURATION_ = 5000;

  /**
   * Maximum amount of time spent searching for extension destinations, in
   * milliseconds.
   * @type {number}
   * @const
   * @private
   */
  DestinationStore.EXTENSION_SEARCH_DURATION_ = 5000;

  /**
   * Localizes printer capabilities.
   * @param {!Object} capabilities Printer capabilities to localize.
   * @return {!Object} Localized capabilities.
   * @private
   */
  DestinationStore.localizeCapabilities_ = function(capabilities) {
    var mediaSize = capabilities.printer.media_size;
    if (mediaSize) {
      var mediaDisplayNames = {
        'ISO_A0': 'A0',
        'ISO_A1': 'A1',
        'ISO_A2': 'A2',
        'ISO_A3': 'A3',
        'ISO_A4': 'A4',
        'ISO_A5': 'A5',
        'NA_LEGAL': 'Legal',
        'NA_LETTER': 'Letter',
        'NA_LEDGER': 'Tabloid'
      };
      for (var i = 0, media; media = mediaSize.option[i]; i++) {
        // No need to patch capabilities with localized names provided.
        if (!media.custom_display_name_localized) {
          media.custom_display_name =
              media.custom_display_name ||
              mediaDisplayNames[media.name] ||
              media.name;
        }
      }
    }
    return capabilities;
  };

  DestinationStore.prototype = {
    __proto__: cr.EventTarget.prototype,

    /**
     * @param {string=} opt_account Account to filter destinations by. When
     *     omitted, all destinations are returned.
     * @return {!Array<!print_preview.Destination>} List of destinations
     *     accessible by the {@code account}.
     */
    destinations: function(opt_account) {
      if (opt_account) {
        return this.destinations_.filter(function(destination) {
          return !destination.account || destination.account == opt_account;
        });
      } else {
        return this.destinations_.slice(0);
      }
    },

    /**
     * @return {print_preview.Destination} The currently selected destination or
     *     {@code null} if none is selected.
     */
    get selectedDestination() {
      return this.selectedDestination_;
    },

    /** @return {boolean} Whether destination selection is pending or not. */
    get isAutoSelectDestinationInProgress() {
      return this.selectedDestination_ == null &&
          this.autoSelectTimeout_ != null;
    },

    /**
     * @return {boolean} Whether a search for local destinations is in progress.
     */
    get isLocalDestinationSearchInProgress() {
      return this.isLocalDestinationSearchInProgress_ ||
        this.isPrivetDestinationSearchInProgress_ ||
        this.isExtensionDestinationSearchInProgress_;
    },

    /**
     * @return {boolean} Whether a search for cloud destinations is in progress.
     */
    get isCloudDestinationSearchInProgress() {
      return !!this.cloudPrintInterface_ &&
             this.cloudPrintInterface_.isCloudDestinationSearchInProgress;
    },

    /**
     * @return {boolean} Whether the selected destination is valid.
     */
    selectedDestinationValid_: function() {
      return this.appState_.selectedDestination &&
             this.appState_.selectedDestination.id &&
             this.appState_.selectedDestination.origin;
    },

    /*
     * Initializes the destination store. Sets the initially selected
     * destination. If any inserted destinations match this ID, that destination
     * will be automatically selected. This method must be called after the
     * print_preview.AppState has been initialized.
     * @param {boolean} isInAppKioskMode Whether the print preview is in App
     *     Kiosk mode.
     * @param {?string} systemDefaultDestinationId ID of the system default
     *     destination.
     * @param {?string} serializedDefaultDestinationSelectionRulesStr Serialized
     *     default destination selection rules.
     */
    init: function(
        isInAppKioskMode,
        systemDefaultDestinationId,
        serializedDefaultDestinationSelectionRulesStr) {
      this.pdfPrinterEnabled_ = !isInAppKioskMode;
      this.systemDefaultDestinationId_ = systemDefaultDestinationId;
      this.createLocalPdfPrintDestination_();

      if (!this.selectedDestinationValid_()) {
        var destinationMatch = this.convertToDestinationMatch_(
            serializedDefaultDestinationSelectionRulesStr);
        if (destinationMatch) {
          this.fetchMatchingDestination_(destinationMatch);
          return;
        }
      }

      if (!this.systemDefaultDestinationId_ &&
          !this.selectedDestinationValid_()) {
        this.selectPdfDestination_();
        return;
      }

      var origin = print_preview.Destination.Origin.LOCAL;
      var id = this.systemDefaultDestinationId_;
      var account = '';
      var name = '';
      var capabilities = null;
      var extensionId = '';
      var extensionName = '';
      var foundDestination = false;
      if (this.appState_.recentDestinations) {
        // Run through the destinations forward. As soon as we find a
        // destination, don't select any future destinations, just mark
        // them recent. Otherwise, there is a race condition between selecting
        // destinations/updating the print ticket and this selecting a new
        // destination that causes random print preview errors.
        for (var i = 0; i < this.appState_.recentDestinations.length; i++) {
          origin = this.appState_.recentDestinations[i].origin;
          id = this.appState_.recentDestinations[i].id;
          account = this.appState_.recentDestinations[i].account || '';
          name = this.appState_.recentDestinations[i].name || '';
          capabilities = this.appState_.recentDestinations[i].capabilities;
          extensionId = this.appState_.recentDestinations[i].extensionId ||
                        '';
          extensionName =
              this.appState_.recentDestinations[i].extensionName || '';
          var candidate =
              this.destinationMap_[this.getDestinationKey_(origin,
                                                           id, account)];
          if (candidate != null) {
            if (!foundDestination)
              this.selectDestination(candidate);
            candidate.isRecent = true;
            foundDestination = true;
          } else if (!foundDestination) {
            foundDestination = this.fetchPreselectedDestination_(
                                    origin,
                                    id,
                                    account,
                                    name,
                                    capabilities,
                                    extensionId,
                                    extensionName);
          }
        }
      }
      if (foundDestination) return;
      // Try the system default
      var candidate =
          this.destinationMap_[this.getDestinationKey_(origin, id, account)];
      if (candidate != null) {
        this.selectDestination(candidate);
        return;
      }

      if (this.fetchPreselectedDestination_(
              origin,
              id,
              account,
              name,
              capabilities,
              extensionId,
              extensionName)) {
        return;
      }

      this.selectPdfDestination_();
    },

    /**
     * Attempts to fetch capabilities of the destination identified by the
     * provided origin, id and account.
     * @param {!print_preview.Destination.Origin} origin Destination origin.
     * @param {string} id Destination id.
     * @param {string} account User account destination is registered for.
     * @param {string} name Destination display name.
     * @param {?print_preview.Cdd} capabilities Destination capabilities.
     * @param {string} extensionId Extension ID associated with this
     *     destination.
     * @param {string} extensionName Extension name associated with this
     *     destination.
     * @private
     */
    fetchPreselectedDestination_: function(
        origin, id, account, name, capabilities, extensionId, extensionName) {
      this.autoSelectMatchingDestination_ =
          this.createExactDestinationMatch_(origin, id);

      if (origin == print_preview.Destination.Origin.LOCAL) {
        this.nativeLayer_.startGetLocalDestinationCapabilities(id);
        return true;
      }

      if (this.cloudPrintInterface_ &&
          (origin == print_preview.Destination.Origin.COOKIES ||
           origin == print_preview.Destination.Origin.DEVICE)) {
        this.cloudPrintInterface_.printer(id, origin, account);
        return true;
      }

      if (origin == print_preview.Destination.Origin.PRIVET) {
        // TODO(noamsml): Resolve a specific printer instead of listing all
        // privet printers in this case.
        this.nativeLayer_.startGetPrivetDestinations();

        // Create a fake selectedDestination_ that is not actually in the
        // destination store. When the real destination is created, this
        // destination will be overwritten.
        this.selectedDestination_ = new print_preview.Destination(
            id,
            print_preview.Destination.Type.LOCAL,
            print_preview.Destination.Origin.PRIVET,
            name,
            false /*isRecent*/,
            print_preview.Destination.ConnectionStatus.ONLINE);
        this.selectedDestination_.capabilities = capabilities;

        cr.dispatchSimpleEvent(
          this,
          DestinationStore.EventType.CACHED_SELECTED_DESTINATION_INFO_READY);
        return true;
      }

      if (origin == print_preview.Destination.Origin.EXTENSION) {
        // TODO(tbarzic): Add support for requesting a single extension's
        // printer list.
        this.startLoadExtensionDestinations();

        this.selectedDestination_ =
            print_preview.ExtensionDestinationParser.parse({
              extensionId: extensionId,
              extensionName: extensionName,
              id: id,
              name: name
            });

        if (capabilities) {
          this.selectedDestination_.capabilities = capabilities;

          cr.dispatchSimpleEvent(
              this,
              DestinationStore.EventType
                  .CACHED_SELECTED_DESTINATION_INFO_READY);
        }
        return true;
      }

      return false;
    },

    /**
     * Attempts to find a destination matching the provided rules.
     * @param {!print_preview.DestinationMatch} destinationMatch Rules to match.
     * @private
     */
    fetchMatchingDestination_: function(destinationMatch) {
      this.autoSelectMatchingDestination_ = destinationMatch;

      if (destinationMatch.matchOrigin(
            print_preview.Destination.Origin.LOCAL)) {
        this.startLoadLocalDestinations();
      }
      if (destinationMatch.matchOrigin(
            print_preview.Destination.Origin.PRIVET)) {
        this.startLoadPrivetDestinations();
      }
      if (destinationMatch.matchOrigin(
            print_preview.Destination.Origin.EXTENSION)) {
        this.startLoadExtensionDestinations();
      }
      if (destinationMatch.matchOrigin(
            print_preview.Destination.Origin.COOKIES) ||
          destinationMatch.matchOrigin(
            print_preview.Destination.Origin.DEVICE) ||
          destinationMatch.matchOrigin(
            print_preview.Destination.Origin.PROFILE)) {
        this.startLoadCloudDestinations();
      }
    },

    /**
     * @param {?string} serializedDefaultDestinationSelectionRulesStr Serialized
     *     default destination selection rules.
     * @return {!print_preview.DestinationMatch} Creates rules matching
     *     previously selected destination.
     * @private
     */
    convertToDestinationMatch_: function(
        serializedDefaultDestinationSelectionRulesStr) {
      var matchRules = null;
      try {
        if (serializedDefaultDestinationSelectionRulesStr) {
          matchRules =
              JSON.parse(serializedDefaultDestinationSelectionRulesStr);
        }
      } catch(e) {
        console.error(
            'Failed to parse defaultDestinationSelectionRules: ' + e);
      }
      if (!matchRules)
        return;

      var isLocal = !matchRules.kind || matchRules.kind == 'local';
      var isCloud = !matchRules.kind || matchRules.kind == 'cloud';
      if (!isLocal && !isCloud) {
        console.error('Unsupported type: "' + matchRules.kind + '"');
        return null;
      }

      var origins = [];
      if (isLocal) {
        origins.push(print_preview.Destination.Origin.LOCAL);
        origins.push(print_preview.Destination.Origin.PRIVET);
        origins.push(print_preview.Destination.Origin.EXTENSION);
      }
      if (isCloud) {
        origins.push(print_preview.Destination.Origin.COOKIES);
        origins.push(print_preview.Destination.Origin.DEVICE);
        origins.push(print_preview.Destination.Origin.PROFILE);
      }

      var idRegExp = null;
      try {
        if (matchRules.idPattern) {
          idRegExp = new RegExp(matchRules.idPattern || '.*');
        }
      } catch (e) {
        console.error('Failed to parse regexp for "id": ' + e);
      }

      var displayNameRegExp = null;
      try {
        if (matchRules.namePattern) {
          displayNameRegExp = new RegExp(matchRules.namePattern || '.*');
        }
      } catch (e) {
        console.error('Failed to parse regexp for "name": ' + e);
      }

      return new DestinationMatch(
          origins,
          idRegExp,
          displayNameRegExp,
          true /*skipVirtualDestinations*/);
    },

    /**
     * @return {print_preview.DestinationMatch} Creates rules matching
     *     previously selected destination.
     * @private
     */
    convertPreselectedToDestinationMatch_: function() {
      if (this.selectedDestinationValid_()) {
        return this.createExactDestinationMatch_(
            this.appState_.selectedDestination.origin,
            this.appState_.selectedDestination.id);
      }
      if (this.systemDefaultDestinationId_) {
        return this.createExactDestinationMatch_(
            print_preview.Destination.Origin.LOCAL,
            this.systemDefaultDestinationId_);
      }
      return null;
    },

    /**
     * @param {!print_preview.Destination.Origin} origin Destination origin.
     * @param {string} id Destination id.
     * @return {!print_preview.DestinationMatch} Creates rules matching
     *     provided destination.
     * @private
     */
    createExactDestinationMatch_: function(origin, id) {
      return new DestinationMatch(
          [origin],
          new RegExp('^' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'),
          null /*displayNameRegExp*/,
          false /*skipVirtualDestinations*/);
    },

    /**
     * Sets the destination store's Google Cloud Print interface.
     * @param {!cloudprint.CloudPrintInterface} cloudPrintInterface Interface
     *     to set.
     */
    setCloudPrintInterface: function(cloudPrintInterface) {
      this.cloudPrintInterface_ = cloudPrintInterface;
      this.tracker_.add(
          this.cloudPrintInterface_,
          cloudprint.CloudPrintInterface.EventType.SEARCH_DONE,
          this.onCloudPrintSearchDone_.bind(this));
      this.tracker_.add(
          this.cloudPrintInterface_,
          cloudprint.CloudPrintInterface.EventType.SEARCH_FAILED,
          this.onCloudPrintSearchDone_.bind(this));
      this.tracker_.add(
          this.cloudPrintInterface_,
          cloudprint.CloudPrintInterface.EventType.PRINTER_DONE,
          this.onCloudPrintPrinterDone_.bind(this));
      this.tracker_.add(
          this.cloudPrintInterface_,
          cloudprint.CloudPrintInterface.EventType.PRINTER_FAILED,
          this.onCloudPrintPrinterFailed_.bind(this));
      this.tracker_.add(
          this.cloudPrintInterface_,
          cloudprint.CloudPrintInterface.EventType.PROCESS_INVITE_DONE,
          this.onCloudPrintProcessInviteDone_.bind(this));
    },

    /**
     * @return {boolean} Whether only default cloud destinations have been
     *     loaded.
     */
    hasOnlyDefaultCloudDestinations: function() {
      // TODO: Move the logic to print_preview.
      return this.destinations_.every(function(dest) {
        return dest.isLocal ||
            dest.id == print_preview.Destination.GooglePromotedId.DOCS ||
            dest.id == print_preview.Destination.GooglePromotedId.FEDEX;
      });
    },

    /**
     * @param {print_preview.Destination} destination Destination to select.
     */
    selectDestination: function(destination) {
      this.autoSelectMatchingDestination_ = null;
      // When auto select expires, DESTINATION_SELECT event has to be dispatched
      // anyway (see isAutoSelectDestinationInProgress() logic).
      if (this.autoSelectTimeout_) {
        clearTimeout(this.autoSelectTimeout_);
        this.autoSelectTimeout_ = null;
      } else if (destination == this.selectedDestination_) {
        return;
      }
      if (destination == null) {
        this.selectedDestination_ = null;
        cr.dispatchSimpleEvent(
            this, DestinationStore.EventType.DESTINATION_SELECT);
        return;
      }

      assert(!destination.isProvisional,
             'Unable to select provisonal destinations');

      // Update and persist selected destination.
      this.selectedDestination_ = destination;
      this.selectedDestination_.isRecent = true;
      if (destination.id == print_preview.Destination.GooglePromotedId.FEDEX &&
          !destination.isTosAccepted) {
        assert(this.cloudPrintInterface_ != null,
               'Selected FedEx destination, but GCP API is not available');
        destination.isTosAccepted = true;
        this.cloudPrintInterface_.updatePrinterTosAcceptance(destination, true);
      }
      this.appState_.persistSelectedDestination(this.selectedDestination_);
      // Adjust metrics.
      if (destination.cloudID &&
          this.destinations_.some(function(otherDestination) {
            return otherDestination.cloudID == destination.cloudID &&
                otherDestination != destination;
          })) {
        this.metrics_.record(destination.isPrivet ?
            print_preview.Metrics.DestinationSearchBucket.
                PRIVET_DUPLICATE_SELECTED :
            print_preview.Metrics.DestinationSearchBucket.
                CLOUD_DUPLICATE_SELECTED);
      }
      // Notify about selected destination change.
      cr.dispatchSimpleEvent(
          this, DestinationStore.EventType.DESTINATION_SELECT);
      // Request destination capabilities, of not known yet.
      if (destination.capabilities == null) {
        if (destination.isPrivet) {
          this.nativeLayer_.startGetPrivetDestinationCapabilities(
              destination.id);
        } else if (destination.isExtension) {
          this.nativeLayer_.startGetExtensionDestinationCapabilities(
              destination.id);
        } else if (destination.isLocal) {
          this.nativeLayer_.startGetLocalDestinationCapabilities(
              destination.id);
        } else {
          assert(this.cloudPrintInterface_ != null,
                 'Cloud destination selected, but GCP is not enabled');
          this.cloudPrintInterface_.printer(
              destination.id, destination.origin, destination.account);
        }
      } else {
        cr.dispatchSimpleEvent(
            this,
            DestinationStore.EventType.SELECTED_DESTINATION_CAPABILITIES_READY);
      }
    },

    /**
     * Attempts to resolve a provisional destination.
     * @param {!print_preview.Destination} destinaion Provisional destination
     *     that should be resolved.
     */
    resolveProvisionalDestination: function(destination) {
      assert(
          destination.provisionalType ==
              print_preview.Destination.ProvisionalType.NEEDS_USB_PERMISSION,
          'Provisional type cannot be resolved.');
      this.nativeLayer_.grantExtensionPrinterAccess(destination.id);
    },

    /**
     * Selects 'Save to PDF' destination (since it always exists).
     * @private
     */
    selectPdfDestination_: function() {
      var saveToPdfKey = this.getDestinationKey_(
          print_preview.Destination.Origin.LOCAL,
          print_preview.Destination.GooglePromotedId.SAVE_AS_PDF,
          '');
      this.selectDestination(
          this.destinationMap_[saveToPdfKey] || this.destinations_[0] || null);
    },

    /**
     * Attempts to select system default destination with a fallback to
     * 'Save to PDF' destination.
     * @private
     */
    selectDefaultDestination_: function() {
      if (this.systemDefaultDestinationId_) {
        if (this.autoSelectMatchingDestination_ &&
            !this.autoSelectMatchingDestination_.matchIdAndOrigin(
                this.systemDefaultDestinationId_,
                print_preview.Destination.Origin.LOCAL)) {
          if (this.fetchPreselectedDestination_(
                print_preview.Destination.Origin.LOCAL,
                this.systemDefaultDestinationId_,
                '' /*account*/,
                '' /*name*/,
                null /*capabilities*/,
                '' /*extensionId*/,
                '' /*extensionName*/)) {
            return;
          }
        }
      }
      this.selectPdfDestination_();
    },

    /** Initiates loading of local print destinations. */
    startLoadLocalDestinations: function() {
      if (!this.hasLoadedAllLocalDestinations_) {
        this.hasLoadedAllLocalDestinations_ = true;
        this.nativeLayer_.startGetLocalDestinations();
        this.isLocalDestinationSearchInProgress_ = true;
        cr.dispatchSimpleEvent(
            this, DestinationStore.EventType.DESTINATION_SEARCH_STARTED);
      }
    },

    /** Initiates loading of privet print destinations. */
    startLoadPrivetDestinations: function() {
      if (!this.hasLoadedAllPrivetDestinations_) {
        if (this.privetDestinationSearchInProgress_)
          clearTimeout(this.privetSearchTimeout_);
        this.isPrivetDestinationSearchInProgress_ = true;
        this.nativeLayer_.startGetPrivetDestinations();
        cr.dispatchSimpleEvent(
            this, DestinationStore.EventType.DESTINATION_SEARCH_STARTED);
        this.privetSearchTimeout_ = setTimeout(
            this.endPrivetPrinterSearch_.bind(this),
            DestinationStore.PRIVET_SEARCH_DURATION_);
      }
    },

    /** Initializes loading of extension managed print destinations. */
    startLoadExtensionDestinations: function() {
      if (this.hasLoadedAllExtensionDestinations_)
        return;

      if (this.isExtensionDestinationSearchInProgress_)
        clearTimeout(this.extensionSearchTimeout_);

      this.isExtensionDestinationSearchInProgress_ = true;
      this.nativeLayer_.startGetExtensionDestinations();
      cr.dispatchSimpleEvent(
          this, DestinationStore.EventType.DESTINATION_SEARCH_STARTED);
      this.extensionSearchTimeout_ = setTimeout(
          this.endExtensionPrinterSearch_.bind(this),
          DestinationStore.EXTENSION_SEARCH_DURATION_);
    },

    /**
     * Initiates loading of cloud destinations.
     * @param {print_preview.Destination.Origin=} opt_origin Search destinations
     *     for the specified origin only.
     */
    startLoadCloudDestinations: function(opt_origin) {
      if (this.cloudPrintInterface_ != null) {
        var origins = this.loadedCloudOrigins_[this.userInfo_.activeUser] || [];
        if (origins.length == 0 ||
            (opt_origin && origins.indexOf(opt_origin) < 0)) {
          this.cloudPrintInterface_.search(
              this.userInfo_.activeUser, opt_origin);
          cr.dispatchSimpleEvent(
              this, DestinationStore.EventType.DESTINATION_SEARCH_STARTED);
        }
      }
    },

    /** Requests load of COOKIE based cloud destinations. */
    reloadUserCookieBasedDestinations: function() {
      var origins = this.loadedCloudOrigins_[this.userInfo_.activeUser] || [];
      if (origins.indexOf(print_preview.Destination.Origin.COOKIES) >= 0) {
        cr.dispatchSimpleEvent(
            this, DestinationStore.EventType.DESTINATION_SEARCH_DONE);
      } else {
        this.startLoadCloudDestinations(
            print_preview.Destination.Origin.COOKIES);
      }
    },

    /** Initiates loading of all known destination types. */
    startLoadAllDestinations: function() {
      this.startLoadCloudDestinations();
      this.startLoadLocalDestinations();
      this.startLoadPrivetDestinations();
      this.startLoadExtensionDestinations();
    },

    /**
     * Wait for a privet device to be registered.
     */
    waitForRegister: function(id) {
      this.nativeLayer_.startGetPrivetDestinations();
      this.waitForRegisterDestination_ = id;
    },

    /**
     * Event handler for {@code
     * print_preview.NativeLayer.EventType.PROVISIONAL_DESTINATION_RESOLVED}.
     * Currently assumes the provisional destination is an extension
     * destination.
     * Called when a provisional destination resolvement attempt finishes.
     * The provisional destination is removed from the store and replaced with
     * a destination created from the resolved destination properties, if any
     * are reported.
     * Emits {@code DestinationStore.EventType.PROVISIONAL_DESTINATION_RESOLVED}
     * event.
     * @param {!Event} The event containing the provisional destination ID and
     *     resolved destination description. If the destination was not
     *     successfully resolved, the description will not be set.
     * @private
     */
    handleProvisionalDestinationResolved_: function(evt) {
      var provisionalDestinationIndex = -1;
      var provisionalDestination = null;
      for (var i = 0; i < this.destinations_.length; ++i) {
        if (evt.provisionalId == this.destinations_[i].id) {
          provisionalDestinationIndex = i;
          provisionalDestination = this.destinations_[i];
          break;
        }
      }

      if (!provisionalDestination)
        return;

      this.destinations_.splice(provisionalDestinationIndex, 1);
      delete this.destinationMap_[this.getKey_(provisionalDestination)];

      var destination = evt.destination ?
          print_preview.ExtensionDestinationParser.parse(evt.destination) :
          null;

      if (destination)
        this.insertIntoStore_(destination);

      var event = new Event(
          DestinationStore.EventType.PROVISIONAL_DESTINATION_RESOLVED);
      event.provisionalId = evt.provisionalId;
      event.destination = destination;
      this.dispatchEvent(event);
    },

    /**
     * Inserts {@code destination} to the data store and dispatches a
     * DESTINATIONS_INSERTED event.
     * @param {!print_preview.Destination} destination Print destination to
     *     insert.
     * @private
     */
    insertDestination_: function(destination) {
      if (this.insertIntoStore_(destination)) {
        this.destinationsInserted_(destination);
      }
    },

    /**
     * Inserts multiple {@code destinations} to the data store and dispatches
     * single DESTINATIONS_INSERTED event.
     * @param {!Array<print_preview.Destination>} destinations Print
     *     destinations to insert.
     * @private
     */
    insertDestinations_: function(destinations) {
      var inserted = false;
      destinations.forEach(function(destination) {
        inserted = this.insertIntoStore_(destination) || inserted;
      }, this);
      if (inserted) {
        this.destinationsInserted_();
      }
    },

    /**
     * Dispatches DESTINATIONS_INSERTED event. In auto select mode, tries to
     * update selected destination to match
     * {@code autoSelectMatchingDestination_}.
     * @param {print_preview.Destination=} opt_destination The only destination
     *     that was changed or skipped if possibly more than one destination was
     *     changed. Used as a hint to limit destination search scope against
     *     {@code autoSelectMatchingDestination_).
     */
    destinationsInserted_: function(opt_destination) {
      cr.dispatchSimpleEvent(
          this, DestinationStore.EventType.DESTINATIONS_INSERTED);
      if (this.autoSelectMatchingDestination_) {
        var destinationsToSearch =
            opt_destination && [opt_destination] || this.destinations_;
        destinationsToSearch.some(function(destination) {
          if (this.autoSelectMatchingDestination_.match(destination)) {
            this.selectDestination(destination);
            return true;
          }
        }, this);
      }
    },

    /**
     * Updates an existing print destination with capabilities and display name
     * information. If the destination doesn't already exist, it will be added.
     * @param {!print_preview.Destination} destination Destination to update.
     * @return {!print_preview.Destination} The existing destination that was
     *     updated or {@code null} if it was the new destination.
     * @private
     */
    updateDestination_: function(destination) {
      assert(destination.constructor !== Array, 'Single printer expected');
      var existingDestination = this.destinationMap_[this.getKey_(destination)];
      if (existingDestination != null) {
        existingDestination.capabilities = destination.capabilities;
      } else {
        this.insertDestination_(destination);
      }

      if (this.selectedDestination_ &&
          (existingDestination == this.selectedDestination_ ||
           destination == this.selectedDestination_)) {
        this.appState_.persistSelectedDestination(this.selectedDestination_);
        cr.dispatchSimpleEvent(
            this,
            DestinationStore.EventType.SELECTED_DESTINATION_CAPABILITIES_READY);
      }

      return existingDestination;
    },

    /**
     * Called when the search for Privet printers is done.
     * @private
     */
    endPrivetPrinterSearch_: function() {
      this.nativeLayer_.stopGetPrivetDestinations();
      this.isPrivetDestinationSearchInProgress_ = false;
      this.hasLoadedAllPrivetDestinations_ = true;
      cr.dispatchSimpleEvent(
          this, DestinationStore.EventType.DESTINATION_SEARCH_DONE);
    },

    /**
     * Called when loading of extension managed printers is done.
     * @private
     */
    endExtensionPrinterSearch_: function() {
      this.isExtensionDestinationSearchInProgress_ = false;
      this.hasLoadedAllExtensionDestinations_ = true;
      cr.dispatchSimpleEvent(
          this, DestinationStore.EventType.DESTINATION_SEARCH_DONE);
      // Clear initially selected (cached) extension destination if it hasn't
      // been found among reported extension destinations.
      if (this.autoSelectMatchingDestination_ &&
          this.autoSelectMatchingDestination_.matchOrigin(
              print_preview.Destination.Origin.EXTENSION) &&
          this.selectedDestination_ &&
          this.selectedDestination_.isExtension) {
        this.selectDefaultDestination_();
      }
    },

    /**
     * Inserts a destination into the store without dispatching any events.
     * @return {boolean} Whether the inserted destination was not already in the
     *     store.
     * @private
     */
    insertIntoStore_: function(destination) {
      var key = this.getKey_(destination);
      var existingDestination = this.destinationMap_[key];
      if (existingDestination == null) {
        destination.isRecent |= this.appState_.recentDestinations.some(
            function(recent) {
              return (destination.id == recent.id &&
                      destination.origin == recent.origin);
            }, this);
        this.destinations_.push(destination);
        this.destinationMap_[key] = destination;
        return true;
      } else if (existingDestination.connectionStatus ==
                     print_preview.Destination.ConnectionStatus.UNKNOWN &&
                 destination.connectionStatus !=
                     print_preview.Destination.ConnectionStatus.UNKNOWN) {
        existingDestination.connectionStatus = destination.connectionStatus;
        return true;
      } else {
        return false;
      }
    },

    /**
     * Binds handlers to events.
     * @private
     */
    addEventListeners_: function() {
      this.tracker_.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.LOCAL_DESTINATIONS_SET,
          this.onLocalDestinationsSet_.bind(this));
      this.tracker_.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.CAPABILITIES_SET,
          this.onLocalDestinationCapabilitiesSet_.bind(this));
      this.tracker_.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.GET_CAPABILITIES_FAIL,
          this.onGetCapabilitiesFail_.bind(this));
      this.tracker_.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.DESTINATIONS_RELOAD,
          this.onDestinationsReload_.bind(this));
      this.tracker_.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.PRIVET_PRINTER_CHANGED,
          this.onPrivetPrinterAdded_.bind(this));
      this.tracker_.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.PRIVET_CAPABILITIES_SET,
          this.onPrivetCapabilitiesSet_.bind(this));
      this.tracker_.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.EXTENSION_PRINTERS_ADDED,
          this.onExtensionPrintersAdded_.bind(this));
      this.tracker_.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.EXTENSION_CAPABILITIES_SET,
          this.onExtensionCapabilitiesSet_.bind(this));
      this.tracker_.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.PROVISIONAL_DESTINATION_RESOLVED,
          this.handleProvisionalDestinationResolved_.bind(this));
    },

    /**
     * Creates a local PDF print destination.
     * @return {!print_preview.Destination} Created print destination.
     * @private
     */
    createLocalPdfPrintDestination_: function() {
      // TODO(alekseys): Create PDF printer in the native code and send its
      // capabilities back with other local printers.
      if (this.pdfPrinterEnabled_) {
        this.insertDestination_(new print_preview.Destination(
            print_preview.Destination.GooglePromotedId.SAVE_AS_PDF,
            print_preview.Destination.Type.LOCAL,
            print_preview.Destination.Origin.LOCAL,
            loadTimeData.getString('printToPDF'),
            false /*isRecent*/,
            print_preview.Destination.ConnectionStatus.ONLINE));
      }
    },

    /**
     * Resets the state of the destination store to its initial state.
     * @private
     */
    reset_: function() {
      this.destinations_ = [];
      this.destinationMap_ = {};
      this.selectDestination(null);
      this.loadedCloudOrigins_ = {};
      this.hasLoadedAllLocalDestinations_ = false;
      this.hasLoadedAllPrivetDestinations_ = false;
      this.hasLoadedAllExtensionDestinations_ = false;

      clearTimeout(this.autoSelectTimeout_);
      this.autoSelectTimeout_ = setTimeout(
          this.selectDefaultDestination_.bind(this),
          DestinationStore.AUTO_SELECT_TIMEOUT_);
    },

    /**
     * Called when the local destinations have been got from the native layer.
     * @param {Event} event Contains the local destinations.
     * @private
     */
    onLocalDestinationsSet_: function(event) {
      var localDestinations = event.destinationInfos.map(function(destInfo) {
        return print_preview.LocalDestinationParser.parse(destInfo);
      });
      this.insertDestinations_(localDestinations);
      this.isLocalDestinationSearchInProgress_ = false;
      cr.dispatchSimpleEvent(
          this, DestinationStore.EventType.DESTINATION_SEARCH_DONE);
    },

    /**
     * Called when the native layer retrieves the capabilities for the selected
     * local destination. Updates the destination with new capabilities if the
     * destination already exists, otherwise it creates a new destination and
     * then updates its capabilities.
     * @param {Event} event Contains the capabilities of the local print
     *     destination.
     * @private
     */
    onLocalDestinationCapabilitiesSet_: function(event) {
      var destinationId = event.settingsInfo['printerId'];
      var printerName = event.settingsInfo['printerName'];
      var printerDescription = event.settingsInfo['printerDescription'];
      var key = this.getDestinationKey_(
          print_preview.Destination.Origin.LOCAL,
          destinationId,
          '');
      var destination = this.destinationMap_[key];
      var capabilities = DestinationStore.localizeCapabilities_(
          event.settingsInfo.capabilities);
      // Special case for PDF printer (until local printers capabilities are
      // reported in CDD format too).
      if (destinationId ==
          print_preview.Destination.GooglePromotedId.SAVE_AS_PDF) {
        if (destination) {
          destination.capabilities = capabilities;
        }
      } else {
        if (destination) {
          // In case there were multiple capabilities request for this local
          // destination, just ignore the later ones.
          if (destination.capabilities != null) {
            return;
          }
          destination.capabilities = capabilities;
        } else {
          destination = print_preview.LocalDestinationParser.parse(
              {deviceName: destinationId,
               printerName: printerName,
               printerDescription: printerDescription});
          destination.capabilities = capabilities;
          this.insertDestination_(destination);
        }
      }
      if (this.selectedDestination_ &&
          this.selectedDestination_.id == destinationId) {
        cr.dispatchSimpleEvent(
            this,
            DestinationStore.EventType.SELECTED_DESTINATION_CAPABILITIES_READY);
      }
    },

    /**
     * Called when a request to get a local destination's print capabilities
     * fails. If the destination is the initial destination, auto-select another
     * destination instead.
     * @param {Event} event Contains the destination ID that failed.
     * @private
     */
    onGetCapabilitiesFail_: function(event) {
      console.error('Failed to get print capabilities for printer ' +
                    event.destinationId);
      if (this.autoSelectMatchingDestination_ &&
          this.autoSelectMatchingDestination_.matchIdAndOrigin(
              event.destinationId, event.destinationOrigin)) {
        this.selectDefaultDestination_();
      }
    },

    /**
     * Called when the /search call completes, either successfully or not.
     * In case of success, stores fetched destinations.
     * @param {Event} event Contains the request result.
     * @private
     */
    onCloudPrintSearchDone_: function(event) {
      if (event.printers) {
        this.insertDestinations_(event.printers);
      }
      if (event.searchDone) {
        var origins = this.loadedCloudOrigins_[event.user] || [];
        if (origins.indexOf(event.origin) < 0) {
          this.loadedCloudOrigins_[event.user] = origins.concat([event.origin]);
        }
      }
      cr.dispatchSimpleEvent(
          this, DestinationStore.EventType.DESTINATION_SEARCH_DONE);
    },

    /**
     * Called when /printer call completes. Updates the specified destination's
     * print capabilities.
     * @param {Event} event Contains detailed information about the
     *     destination.
     * @private
     */
    onCloudPrintPrinterDone_: function(event) {
      this.updateDestination_(event.printer);
    },

    /**
     * Called when the Google Cloud Print interface fails to lookup a
     * destination. Selects another destination if the failed destination was
     * the initial destination.
     * @param {Object} event Contains the ID of the destination that was failed
     *     to be looked up.
     * @private
     */
    onCloudPrintPrinterFailed_: function(event) {
      if (this.autoSelectMatchingDestination_ &&
          this.autoSelectMatchingDestination_.matchIdAndOrigin(
              event.destinationId, event.destinationOrigin)) {
        console.error(
            'Failed to fetch last used printer caps: ' + event.destinationId);
        this.selectDefaultDestination_();
      }
    },

    /**
     * Called when printer sharing invitation was processed successfully.
     * @param {Event} event Contains detailed information about the invite and
     *     newly accepted destination (if known).
     * @private
     */
    onCloudPrintProcessInviteDone_: function(event) {
      if (event.accept && event.printer) {
        // Hint the destination list to promote this new destination.
        event.printer.isRecent = true;
        this.insertDestination_(event.printer);
      }
    },

    /**
     * Called when a Privet printer is added to the local network.
     * @param {Object} event Contains information about the added printer.
     * @private
     */
    onPrivetPrinterAdded_: function(event) {
      if (event.printer.serviceName == this.waitForRegisterDestination_ &&
          !event.printer.isUnregistered) {
        this.waitForRegisterDestination_ = null;
        this.onDestinationsReload_();
      } else {
        this.insertDestinations_(
            print_preview.PrivetDestinationParser.parse(event.printer));
      }
    },

    /**
     * Called when capabilities for a privet printer are set.
     * @param {Object} event Contains the capabilities and printer ID.
     * @private
     */
    onPrivetCapabilitiesSet_: function(event) {
      var destinations =
          print_preview.PrivetDestinationParser.parse(event.printer);
      destinations.forEach(function(dest) {
        dest.capabilities = event.capabilities;
        this.updateDestination_(dest);
      }, this);
    },

    /**
     * Called when an extension responds to a getExtensionDestinations
     * request.
     * @param {Object} event Contains information about list of printers
     *     reported by the extension.
     *     {@code done} parameter is set iff this is the final list of printers
     *     returned as part of getExtensionDestinations request.
     * @private
     */
    onExtensionPrintersAdded_: function(event) {
      this.insertDestinations_(event.printers.map(function(printer) {
        return print_preview.ExtensionDestinationParser.parse(printer);
      }));

      if (event.done && this.isExtensionDestinationSearchInProgress_) {
        clearTimeout(this.extensionSearchTimeout_);
        this.endExtensionPrinterSearch_();
      }
    },

    /**
     * Called when capabilities for an extension managed printer are set.
     * @param {Object} event Contains the printer's capabilities and ID.
     * @private
     */
    onExtensionCapabilitiesSet_: function(event) {
      var destinationKey = this.getDestinationKey_(
          print_preview.Destination.Origin.EXTENSION,
          event.printerId,
          '' /* account */);
      var destination = this.destinationMap_[destinationKey];
      if (!destination)
        return;
      destination.capabilities = event.capabilities;
      this.updateDestination_(destination);
    },

    /**
     * Called from native layer after the user was requested to sign in, and did
     * so successfully.
     * @private
     */
    onDestinationsReload_: function() {
      this.reset_();
      this.autoSelectMatchingDestination_ =
          this.convertPreselectedToDestinationMatch_();
      this.createLocalPdfPrintDestination_();
      this.startLoadAllDestinations();
    },

    // TODO(vitalybuka): Remove three next functions replacing Destination.id
    //    and Destination.origin by complex ID.
    /**
     * Returns key to be used with {@code destinationMap_}.
     * @param {!print_preview.Destination.Origin} origin Destination origin.
     * @param {string} id Destination id.
     * @param {string} account User account destination is registered for.
     * @private
     */
    getDestinationKey_: function(origin, id, account) {
      return origin + '/' + id + '/' + account;
    },

    /**
     * Returns key to be used with {@code destinationMap_}.
     * @param {!print_preview.Destination} destination Destination.
     * @private
     */
    getKey_: function(destination) {
      return this.getDestinationKey_(
          destination.origin, destination.id, destination.account);
    }
  };

  // Export
  return {
    DestinationStore: DestinationStore
  };
});

// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Printer sharing invitation data object.
   * @param {string} sender Text identifying invitation sender.
   * @param {string} receiver Text identifying invitation receiver. Empty in
   *     case of a personal invitation. Identifies a group or domain in case
   *     of an invitation received by a group manager.
   * @param {!print_preview.Destination} destination Shared destination.
   * @param {!Object} aclEntry JSON representation of the ACL entry this
   *     invitation was sent to.
   * @param {string} account User account this invitation is sent for.
   * @constructor
   */
  function Invitation(sender, receiver, destination, aclEntry, account) {
    /**
     * Text identifying invitation sender.
     * @private {string}
     */
    this.sender_ = sender;

    /**
     * Text identifying invitation receiver. Empty in case of a personal
     * invitation. Identifies a group or domain in case of an invitation
     * received by a group manager.
     * @private {string}
     */
    this.receiver_ = receiver;

    /**
     * Shared destination.
     * @private {!print_preview.Destination}
     */
    this.destination_ = destination;

    /**
     * JSON representation of the ACL entry this invitation was sent to.
     * @private {!Object}
     */
    this.aclEntry_ = aclEntry;

    /**
     * Account this invitation is sent for.
     * @private {string}
     */
    this.account_ = account;
  };

  Invitation.prototype = {
    /** @return {string} Text identifying invitation sender. */
    get sender() {
      return this.sender_;
    },

    /** @return {string} Text identifying invitation receiver. */
    get receiver() {
      return this.receiver_;
    },

    /**
     * @return {boolean} Whether this user acts as a manager for a group of
     * users.
     */
    get asGroupManager() {
      return !!this.receiver_;
    },

    /** @return {!print_preview.Destination} Shared destination. */
    get destination() {
      return this.destination_;
    },

    /** @return {string} Scope (account) this invitation was sent to. */
    get scopeId() {
      return this.aclEntry_['scope'] || '';
    },

    /** @return {string} Account this invitation is sent for. */
    get account() {
      return this.account_;
    }
  };

  // Export
  return {
    Invitation: Invitation
  };
});

// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Printer sharing invitations data store.
   * @param {!print_preview.UserInfo} userInfo User information repository.
   * @constructor
   * @extends {cr.EventTarget}
   */
  function InvitationStore(userInfo) {
    cr.EventTarget.call(this);

    /**
     * User information repository.
     * @private {!print_preview.UserInfo}
     */
    this.userInfo_ = userInfo;

    /**
     * Maps user account to the list of invitations for this account.
     * @private {!Object<!Array<!print_preview.Invitation>>}
     */
    this.invitations_ = {};

    /**
     * Maps user account to the flag whether the invitations for this account
     * were successfully loaded.
     * @private {!Object<print_preview.InvitationStore.LoadStatus_>}
     */
    this.loadStatus_ = {};

    /**
     * Event tracker used to track event listeners of the destination store.
     * @private {!EventTracker}
     */
    this.tracker_ = new EventTracker();

    /**
     * Used to fetch and process invitations.
     * @private {print_preview.CloudPrintInterface}
     */
    this.cloudPrintInterface_ = null;

    /**
     * Invitation being processed now. Only one invitation can be processed at
     * a time.
     * @private {print_preview.Invitation}
     */
    this.invitationInProgress_ = null;
  };

  /**
   * Event types dispatched by the data store.
   * @enum {string}
   */
  InvitationStore.EventType = {
    INVITATION_PROCESSED:
        'print_preview.InvitationStore.INVITATION_PROCESSED',
    INVITATION_SEARCH_DONE:
        'print_preview.InvitationStore.INVITATION_SEARCH_DONE'
  };

  /**
   * @enum {number}
   * @private
   */
  InvitationStore.LoadStatus_ = {
    IN_PROGRESS: 1,
    DONE: 2,
    FAILED: 3
  };

  InvitationStore.prototype = {
    __proto__: cr.EventTarget.prototype,

    /**
     * @return {print_preview.Invitation} Currently processed invitation or
     *     {@code null}.
     */
    get invitationInProgress() {
      return this.invitationInProgress_;
    },

    /**
     * @param {string} account Account to filter invitations by.
     * @return {!Array<!print_preview.Invitation>} List of invitations for the
     *     {@code account}.
     */
    invitations: function(account) {
      return this.invitations_[account] || [];
    },

    /**
     * Sets the invitation store's Google Cloud Print interface.
     * @param {!print_preview.CloudPrintInterface} cloudPrintInterface Interface
     *     to set.
     */
    setCloudPrintInterface: function(cloudPrintInterface) {
      this.cloudPrintInterface_ = cloudPrintInterface;
      this.tracker_.add(
          this.cloudPrintInterface_,
          cloudprint.CloudPrintInterface.EventType.INVITES_DONE,
          this.onCloudPrintInvitesDone_.bind(this));
      this.tracker_.add(
          this.cloudPrintInterface_,
          cloudprint.CloudPrintInterface.EventType.INVITES_FAILED,
          this.onCloudPrintInvitesDone_.bind(this));
      this.tracker_.add(
          this.cloudPrintInterface_,
          cloudprint.CloudPrintInterface.EventType.PROCESS_INVITE_DONE,
          this.onCloudPrintProcessInviteDone_.bind(this));
      this.tracker_.add(
          this.cloudPrintInterface_,
          cloudprint.CloudPrintInterface.EventType.PROCESS_INVITE_FAILED,
          this.onCloudPrintProcessInviteFailed_.bind(this));
    },

    /** Initiates loading of cloud printer sharing invitations. */
    startLoadingInvitations: function() {
      if (!this.cloudPrintInterface_)
        return;
      if (!this.userInfo_.activeUser)
        return;
      if (this.loadStatus_.hasOwnProperty(this.userInfo_.activeUser)) {
        if (this.loadStatus_[this.userInfo_.activeUser] ==
            InvitationStore.LoadStatus_.DONE) {
          cr.dispatchSimpleEvent(
              this, InvitationStore.EventType.INVITATION_SEARCH_DONE);
        }
        return;
      }

      this.loadStatus_[this.userInfo_.activeUser] =
          InvitationStore.LoadStatus_.IN_PROGRESS;
      this.cloudPrintInterface_.invites(this.userInfo_.activeUser);
    },

    /**
     * Accepts or rejects the {@code invitation}, based on {@code accept} value.
     * @param {!print_preview.Invitation} invitation Invitation to process.
     * @param {boolean} accept Whether to accept this invitation.
     */
    processInvitation: function(invitation, accept) {
      if (!!this.invitationInProgress_)
        return;
      this.invitationInProgress_ = invitation;
      this.cloudPrintInterface_.processInvite(invitation, accept);
    },

    /**
     * Removes processed invitation from the internal storage.
     * @param {!print_preview.Invitation} invitation Processed invitation.
     * @private
     */
    invitationProcessed_: function(invitation) {
      if (this.invitations_.hasOwnProperty(invitation.account)) {
        this.invitations_[invitation.account] =
            this.invitations_[invitation.account].filter(function(i) {
              return i != invitation;
            });
      }
      if (this.invitationInProgress_ == invitation)
        this.invitationInProgress_ = null;
    },

    /**
     * Called when printer sharing invitations are fetched.
     * @param {Event} event Contains the list of invitations.
     * @private
     */
    onCloudPrintInvitesDone_: function(event) {
      this.loadStatus_[event.user] = InvitationStore.LoadStatus_.DONE;
      this.invitations_[event.user] = event.invitations;

      cr.dispatchSimpleEvent(
          this, InvitationStore.EventType.INVITATION_SEARCH_DONE);
    },

    /**
     * Called when printer sharing invitations fetch has failed.
     * @param {Event} event Contains the reason of failure.
     * @private
     */
    onCloudPrintInvitesFailed_: function(event) {
      this.loadStatus_[event.user] = InvitationStore.LoadStatus_.FAILED;
    },

    /**
     * Called when printer sharing invitation was processed successfully.
     * @param {Event} event Contains detailed information about the invite and
     *     newly accepted destination.
     * @private
     */
    onCloudPrintProcessInviteDone_: function(event) {
      this.invitationProcessed_(event.invitation);
      cr.dispatchSimpleEvent(
          this, InvitationStore.EventType.INVITATION_PROCESSED);
    },

    /**
     * Called when /printer call completes. Updates the specified destination's
     * print capabilities.
     * @param {Event} event Contains detailed information about the
     *     destination.
     * @private
     */
    onCloudPrintProcessInviteFailed_: function(event) {
      this.invitationProcessed_(event.invitation);
      // TODO: Display an error.
      cr.dispatchSimpleEvent(
          this, InvitationStore.EventType.INVITATION_PROCESSED);
    }
  };

  // Export
  return {
    InvitationStore: InvitationStore
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Creates a Margins object that holds four margin values in points.
   * @param {number} top The top margin in pts.
   * @param {number} right The right margin in pts.
   * @param {number} bottom The bottom margin in pts.
   * @param {number} left The left margin in pts.
   * @constructor
   */
  function Margins(top, right, bottom, left) {
    /**
     * Backing store for the margin values in points.
     * @type {!Object<
     *     !print_preview.ticket_items.CustomMargins.Orientation, number>}
     * @private
     */
    this.value_ = {};
    this.value_[print_preview.ticket_items.CustomMargins.Orientation.TOP] = top;
    this.value_[print_preview.ticket_items.CustomMargins.Orientation.RIGHT] =
        right;
    this.value_[print_preview.ticket_items.CustomMargins.Orientation.BOTTOM] =
        bottom;
    this.value_[print_preview.ticket_items.CustomMargins.Orientation.LEFT] =
        left;
  };

  /**
   * Parses a margins object from the given serialized state.
   * @param {Object} state Serialized representation of the margins created by
   *     the {@code serialize} method.
   * @return {!print_preview.Margins} New margins instance.
   */
  Margins.parse = function(state) {
    return new print_preview.Margins(
        state[print_preview.ticket_items.CustomMargins.Orientation.TOP] || 0,
        state[print_preview.ticket_items.CustomMargins.Orientation.RIGHT] || 0,
        state[print_preview.ticket_items.CustomMargins.Orientation.BOTTOM] || 0,
        state[print_preview.ticket_items.CustomMargins.Orientation.LEFT] || 0);
  };

  Margins.prototype = {
    /**
     * @param {!print_preview.ticket_items.CustomMargins.Orientation}
     *     orientation Specifies the margin value to get.
     * @return {number} Value of the margin of the given orientation.
     */
    get: function(orientation) {
      return this.value_[orientation];
    },

    /**
     * @param {!print_preview.ticket_items.CustomMargins.Orientation}
     *     orientation Specifies the margin to set.
     * @param {number} value Updated value of the margin in points to modify.
     * @return {!print_preview.Margins} A new copy of |this| with the
     *     modification made to the specified margin.
     */
    set: function(orientation, value) {
      var newValue = this.clone_();
      newValue[orientation] = value;
      return new Margins(
          newValue[print_preview.ticket_items.CustomMargins.Orientation.TOP],
          newValue[print_preview.ticket_items.CustomMargins.Orientation.RIGHT],
          newValue[print_preview.ticket_items.CustomMargins.Orientation.BOTTOM],
          newValue[print_preview.ticket_items.CustomMargins.Orientation.LEFT]);
    },

    /**
     * @param {print_preview.Margins} other The other margins object to compare
     *     against.
     * @return {boolean} Whether this margins object is equal to another.
     */
    equals: function(other) {
      if (other == null) {
        return false;
      }
      for (var orientation in this.value_) {
        if (this.value_[orientation] != other.value_[orientation]) {
          return false;
        }
      }
      return true;
    },

    /** @return {Object} A serialized representation of the margins. */
    serialize: function() {
      return this.clone_();
    },

    /**
     * @return {Object} Cloned state of the margins.
     * @private
     */
    clone_: function() {
      var clone = {};
      for (var o in this.value_) {
        clone[o] = this.value_[o];
      }
      return clone;
    }
  };

  // Export
  return {
    Margins: Margins
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Data model which contains information related to the document to print.
   * @constructor
   * @extends {cr.EventTarget}
   */
  function DocumentInfo() {
    cr.EventTarget.call(this);

    /**
     * Whether the document is styled by CSS media styles.
     * @type {boolean}
     * @private
     */
    this.hasCssMediaStyles_ = false;

    /**
     * Whether the document has selected content.
     * @type {boolean}
     * @private
     */
    this.hasSelection_ = false;

    /**
     * Whether the document to print is modifiable (i.e. can be reflowed).
     * @type {boolean}
     * @private
     */
    this.isModifiable_ = true;

    /**
     * Whether scaling of the document is prohibited.
     * @type {boolean}
     * @private
     */
    this.isScalingDisabled_ = false;

    /**
     * Margins of the document in points.
     * @type {print_preview.Margins}
     * @private
     */
    this.margins_ = null;

    /**
     * Number of pages in the document to print.
     * @type {number}
     * @private
     */
    this.pageCount_ = 0;

    // Create the document info with some initial settings. Actual
    // page-related information won't be set until preview generation occurs,
    // so we'll use some defaults until then. This way, the print ticket store
    // will be valid even if no preview can be generated.
    var initialPageSize = new print_preview.Size(612, 792); // 8.5"x11"

    /**
     * Size of the pages of the document in points.
     * @type {!print_preview.Size}
     * @private
     */
    this.pageSize_ = initialPageSize;

    /**
     * Printable area of the document in points.
     * @type {!print_preview.PrintableArea}
     * @private
     */
    this.printableArea_ = new print_preview.PrintableArea(
        new print_preview.Coordinate2d(0, 0), initialPageSize);

    /**
     * Title of document.
     * @type {string}
     * @private
     */
    this.title_ = '';

    /**
     * Whether this data model has been initialized.
     * @type {boolean}
     * @private
     */
    this.isInitialized_ = false;
  };

  /**
   * Event types dispatched by this data model.
   * @enum {string}
   */
  DocumentInfo.EventType = {
    CHANGE: 'print_preview.DocumentInfo.CHANGE'
  };

  DocumentInfo.prototype = {
    __proto__: cr.EventTarget.prototype,

    /** @return {boolean} Whether the document is styled by CSS media styles. */
    get hasCssMediaStyles() {
      return this.hasCssMediaStyles_;
    },

    /** @return {boolean} Whether the document has selected content. */
    get hasSelection() {
      return this.hasSelection_;
    },

    /**
     * @return {boolean} Whether the document to print is modifiable (i.e. can
     *     be reflowed).
     */
    get isModifiable() {
      return this.isModifiable_;
    },

    /** @return {boolean} Whether scaling of the document is prohibited. */
    get isScalingDisabled() {
      return this.isScalingDisabled_;
    },

    /** @return {print_preview.Margins} Margins of the document in points. */
    get margins() {
      return this.margins_;
    },

    /** @return {number} Number of pages in the document to print. */
    get pageCount() {
      return this.pageCount_;
    },

    /**
     * @return {!print_preview.Size} Size of the pages of the document in
     *     points.
     */
    get pageSize() {
      return this.pageSize_;
    },

    /**
     * @return {!print_preview.PrintableArea} Printable area of the document in
     *     points.
     */
    get printableArea() {
      return this.printableArea_;
    },

    /** @return {string} Title of document. */
    get title() {
      return this.title_;
    },

    /**
     * Initializes the state of the data model and dispatches a CHANGE event.
     * @param {boolean} isModifiable Whether the document is modifiable.
     * @param {string} title Title of the document.
     * @param {boolean} hasSelection Whether the document has user-selected
     *     content.
     */
    init: function(isModifiable, title, hasSelection) {
      this.isModifiable_ = isModifiable;
      this.title_ = title;
      this.hasSelection_ = hasSelection;
      this.isInitialized_ = true;
      cr.dispatchSimpleEvent(this, DocumentInfo.EventType.CHANGE);
    },

    /**
     * Updates whether scaling is disabled for the document and dispatches a
     * CHANGE event.
     * @param {boolean} isScalingDisabled Whether scaling of the document is
     *     prohibited.
     */
    updateIsScalingDisabled: function(isScalingDisabled) {
      if (this.isInitialized_ && this.isScalingDisabled_ != isScalingDisabled) {
        this.isScalingDisabled_ = isScalingDisabled;
        cr.dispatchSimpleEvent(this, DocumentInfo.EventType.CHANGE);
      }
    },

    /**
     * Updates the total number of pages in the document and dispatches a CHANGE
     * event.
     * @param {number} pageCount Number of pages in the document.
     */
    updatePageCount: function(pageCount) {
      if (this.isInitialized_ && this.pageCount_ != pageCount) {
        this.pageCount_ = pageCount;
        cr.dispatchSimpleEvent(this, DocumentInfo.EventType.CHANGE);
      }
    },

    /**
     * Updates information about each page and dispatches a CHANGE event.
     * @param {!print_preview.PrintableArea} printableArea Printable area of the
     *     document in points.
     * @param {!print_preview.Size} pageSize Size of the pages of the document
     *     in points.
     * @param {boolean} hasCssMediaStyles Whether the document is styled by CSS
     *     media styles.
     * @param {print_preview.Margins} margins Margins of the document in points.
     */
    updatePageInfo: function(
        printableArea, pageSize, hasCssMediaStyles, margins) {
      if (this.isInitialized_ &&
          (!this.printableArea_.equals(printableArea) ||
           !this.pageSize_.equals(pageSize) ||
           this.hasCssMediaStyles_ != hasCssMediaStyles ||
           this.margins_ == null || !this.margins_.equals(margins))) {
        this.printableArea_ = printableArea;
        this.pageSize_ = pageSize;
        this.hasCssMediaStyles_ = hasCssMediaStyles;
        this.margins_ = margins;
        cr.dispatchSimpleEvent(this, DocumentInfo.EventType.CHANGE);
      }
    }
  };

  // Export
  return {
    DocumentInfo: DocumentInfo
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Object describing the printable area of a page in the document.
   * @param {!print_preview.Coordinate2d} origin Top left corner of the
   *     printable area of the document.
   * @param {!print_preview.Size} size Size of the printable area of the
   *     document.
   * @constructor
   */
  function PrintableArea(origin, size) {
    /**
     * Top left corner of the printable area of the document.
     * @type {!print_preview.Coordinate2d}
     * @private
     */
    this.origin_ = origin;

    /**
     * Size of the printable area of the document.
     * @type {!print_preview.Size}
     * @private
     */
    this.size_ = size;
  };

  PrintableArea.prototype = {
    /**
     * @return {!print_preview.Coordinate2d} Top left corner of the printable
     *     area of the document.
     */
    get origin() {
      return this.origin_;
    },

    /**
     * @return {!print_preview.Size} Size of the printable area of the document.
     */
    get size() {
      return this.size_;
    },

    /**
     * @param {print_preview.PrintableArea} other Other printable area to check
     *     for equality.
     * @return {boolean} Whether another printable area is equal to this one.
     */
    equals: function(other) {
      return other != null &&
          this.origin_.equals(other.origin_) &&
          this.size_.equals(other.size_);
    }
  };

  // Export
  return {
    PrintableArea: PrintableArea
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Measurement system of the print preview. Used to parse and serialize point
   * measurements into the system's local units (e.g. millimeters, inches).
   * @param {string} thousandsDelimeter Delimeter between thousands digits.
   * @param {string} decimalDelimeter Delimeter between integers and decimals.
   * @param {!print_preview.MeasurementSystem.UnitType} unitType Measurement
   *     unit type of the system.
   * @constructor
   */
  function MeasurementSystem(thousandsDelimeter, decimalDelimeter, unitType) {
    this.thousandsDelimeter_ = thousandsDelimeter || ',';
    this.decimalDelimeter_ = decimalDelimeter || '.';
    this.unitType_ = unitType;
  };

  /**
   * Parses |numberFormat| and extracts the symbols used for the thousands point
   * and decimal point.
   * @param {string} numberFormat The formatted version of the number 12345678.
   * @return {!Array<string>} The extracted symbols in the order
   *     [thousandsSymbol, decimalSymbol]. For example,
   *     parseNumberFormat("123,456.78") returns [",", "."].
   */
  MeasurementSystem.parseNumberFormat = function(numberFormat) {
    if (!numberFormat) {
      return [',', '.'];
    }
    var regex = /^(\d+)(\W?)(\d+)(\W?)(\d+)$/;
    var matches = numberFormat.match(regex) || ['', '', ',', '', '.'];
    return [matches[2], matches[4]];
  };

  /**
   * Enumeration of measurement unit types.
   * @enum {number}
   */
  MeasurementSystem.UnitType = {
    METRIC: 0, // millimeters
    IMPERIAL: 1 // inches
  };

  /**
   * Maximum resolution of local unit values.
   * @type {!Object<!print_preview.MeasurementSystem.UnitType, number>}
   * @private
   */
  MeasurementSystem.Precision_ = {};
  MeasurementSystem.Precision_[MeasurementSystem.UnitType.METRIC] = 0.5;
  MeasurementSystem.Precision_[MeasurementSystem.UnitType.IMPERIAL] = 0.01;

  /**
   * Maximum number of decimal places to keep for local unit.
   * @type {!Object<!print_preview.MeasurementSystem.UnitType, number>}
   * @private
   */
  MeasurementSystem.DecimalPlaces_ = {};
  MeasurementSystem.DecimalPlaces_[MeasurementSystem.UnitType.METRIC] = 1;
  MeasurementSystem.DecimalPlaces_[MeasurementSystem.UnitType.IMPERIAL] = 2;

  /**
   * Number of points per inch.
   * @type {number}
   * @const
   * @private
   */
  MeasurementSystem.PTS_PER_INCH_ = 72.0;

  /**
   * Number of points per millimeter.
   * @type {number}
   * @const
   * @private
   */
  MeasurementSystem.PTS_PER_MM_ = MeasurementSystem.PTS_PER_INCH_ / 25.4;

  MeasurementSystem.prototype = {
    /** @return {string} The unit type symbol of the measurement system. */
    get unitSymbol() {
      if (this.unitType_ == MeasurementSystem.UnitType.METRIC) {
        return 'mm';
      } else if (this.unitType_ == MeasurementSystem.UnitType.IMPERIAL) {
        return '"';
      } else {
        throw Error('Unit type not supported: ' + this.unitType_);
      }
    },

    /**
     * @return {string} The thousands delimeter character of the measurement
     *     system.
     */
    get thousandsDelimeter() {
      return this.thousandsDelimeter_;
    },

    /**
     * @return {string} The decimal delimeter character of the measurement
     *     system.
     */
    get decimalDelimeter() {
      return this.decimalDelimeter_;
    },

    setSystem: function(thousandsDelimeter, decimalDelimeter, unitType) {
      this.thousandsDelimeter_ = thousandsDelimeter;
      this.decimalDelimeter_ = decimalDelimeter;
      this.unitType_ = unitType;
    },

    /**
     * Rounds a value in the local system's units to the appropriate precision.
     * @param {number} value Value to round.
     * @return {number} Rounded value.
     */
    roundValue: function(value) {
      var precision = MeasurementSystem.Precision_[this.unitType_];
      var roundedValue = Math.round(value / precision) * precision;
      // Truncate
      return +roundedValue.toFixed(
          MeasurementSystem.DecimalPlaces_[this.unitType_]);
    },

    /**
     * @param {number} pts Value in points to convert to local units.
     * @return {number} Value in local units.
     */
    convertFromPoints: function(pts) {
      if (this.unitType_ == MeasurementSystem.UnitType.METRIC) {
        return pts / MeasurementSystem.PTS_PER_MM_;
      } else {
        return pts / MeasurementSystem.PTS_PER_INCH_;
      }
    },

    /**
     * @param {number} localUnits Value in local units to convert to points.
     * @return {number} Value in points.
     */
    convertToPoints: function(localUnits) {
      if (this.unitType_ == MeasurementSystem.UnitType.METRIC) {
        return localUnits * MeasurementSystem.PTS_PER_MM_;
      } else {
        return localUnits * MeasurementSystem.PTS_PER_INCH_;
      }
    }
  };

  // Export
  return {
    MeasurementSystem: MeasurementSystem
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  // TODO(rltoscano): Maybe clear print ticket when destination changes. Or
  // better yet, carry over any print ticket state that is possible. I.e. if
  // destination changes, the new destination might not support duplex anymore,
  // so we should clear the ticket's isDuplexEnabled state.

  /**
   * Storage of the print ticket and document statistics. Dispatches events when
   * the contents of the print ticket or document statistics change. Also
   * handles validation of the print ticket against destination capabilities and
   * against the document.
   * @param {!print_preview.DestinationStore} destinationStore Used to
   *     understand which printer is selected.
   * @param {!print_preview.AppState} appState Print preview application state.
   * @param {!print_preview.DocumentInfo} documentInfo Document data model.
   * @constructor
   * @extends {cr.EventTarget}
   */
  function PrintTicketStore(destinationStore, appState, documentInfo) {
    cr.EventTarget.call(this);

    /**
     * Destination store used to understand which printer is selected.
     * @type {!print_preview.DestinationStore}
     * @private
     */
    this.destinationStore_ = destinationStore;

    /**
     * App state used to persist and load ticket values.
     * @type {!print_preview.AppState}
     * @private
     */
    this.appState_ = appState;

    /**
     * Information about the document to print.
     * @type {!print_preview.DocumentInfo}
     * @private
     */
    this.documentInfo_ = documentInfo;

    /**
     * Printing capabilities of Chromium and the currently selected destination.
     * @type {!print_preview.CapabilitiesHolder}
     * @private
     */
    this.capabilitiesHolder_ = new print_preview.CapabilitiesHolder();

    /**
     * Current measurement system. Used to work with margin measurements.
     * @type {!print_preview.MeasurementSystem}
     * @private
     */
    this.measurementSystem_ = new print_preview.MeasurementSystem(
        ',', '.', print_preview.MeasurementSystem.UnitType.IMPERIAL);

    /**
     * Collate ticket item.
     * @type {!print_preview.ticket_items.Collate}
     * @private
     */
    this.collate_ = new print_preview.ticket_items.Collate(
        this.appState_, this.destinationStore_);

    /**
     * Color ticket item.
     * @type {!print_preview.ticket_items.Color}
     * @private
     */
    this.color_ = new print_preview.ticket_items.Color(
        this.appState_, this.destinationStore_);

    /**
     * Copies ticket item.
     * @type {!print_preview.ticket_items.Copies}
     * @private
     */
    this.copies_ =
        new print_preview.ticket_items.Copies(this.destinationStore_);

    /**
     * DPI ticket item.
     * @type {!print_preview.ticket_items.Dpi}
     * @private
     */
    this.dpi_ = new print_preview.ticket_items.Dpi(
        this.appState_, this.destinationStore_);

    /**
     * Duplex ticket item.
     * @type {!print_preview.ticket_items.Duplex}
     * @private
     */
    this.duplex_ = new print_preview.ticket_items.Duplex(
        this.appState_, this.destinationStore_);

    /**
     * Page range ticket item.
     * @type {!print_preview.ticket_items.PageRange}
     * @private
     */
    this.pageRange_ =
        new print_preview.ticket_items.PageRange(this.documentInfo_);

    /**
     * Custom margins ticket item.
     * @type {!print_preview.ticket_items.CustomMargins}
     * @private
     */
    this.customMargins_ = new print_preview.ticket_items.CustomMargins(
        this.appState_, this.documentInfo_);

    /**
     * Margins type ticket item.
     * @type {!print_preview.ticket_items.MarginsType}
     * @private
     */
    this.marginsType_ = new print_preview.ticket_items.MarginsType(
        this.appState_, this.documentInfo_, this.customMargins_);

    /**
     * Media size ticket item.
     * @type {!print_preview.ticket_items.MediaSize}
     * @private
     */
    this.mediaSize_ = new print_preview.ticket_items.MediaSize(
        this.appState_,
        this.destinationStore_,
        this.documentInfo_,
        this.marginsType_,
        this.customMargins_);

    /**
     * Landscape ticket item.
     * @type {!print_preview.ticket_items.Landscape}
     * @private
     */
    this.landscape_ = new print_preview.ticket_items.Landscape(
        this.appState_,
        this.destinationStore_,
        this.documentInfo_,
        this.marginsType_,
        this.customMargins_);

    /**
     * Header-footer ticket item.
     * @type {!print_preview.ticket_items.HeaderFooter}
     * @private
     */
    this.headerFooter_ = new print_preview.ticket_items.HeaderFooter(
        this.appState_,
        this.documentInfo_,
        this.marginsType_,
        this.customMargins_);

    /**
     * Fit-to-page ticket item.
     * @type {!print_preview.ticket_items.FitToPage}
     * @private
     */
    this.fitToPage_ = new print_preview.ticket_items.FitToPage(
        this.appState_, this.documentInfo_, this.destinationStore_);

    /**
     * Print CSS backgrounds ticket item.
     * @type {!print_preview.ticket_items.CssBackground}
     * @private
     */
    this.cssBackground_ = new print_preview.ticket_items.CssBackground(
        this.appState_, this.documentInfo_);

    /**
     * Print selection only ticket item.
     * @type {!print_preview.ticket_items.SelectionOnly}
     * @private
     */
    this.selectionOnly_ =
        new print_preview.ticket_items.SelectionOnly(this.documentInfo_);

    /**
     * Vendor ticket items.
     * @type {!print_preview.ticket_items.VendorItems}
     * @private
     */
    this.vendorItems_ = new print_preview.ticket_items.VendorItems(
        this.appState_, this.destinationStore_);

    /**
     * Keeps track of event listeners for the print ticket store.
     * @type {!EventTracker}
     * @private
     */
    this.tracker_ = new EventTracker();

    /**
     * Whether the print preview has been initialized.
     * @type {boolean}
     * @private
     */
    this.isInitialized_ = false;

    this.addEventListeners_();
  };

  /**
   * Event types dispatched by the print ticket store.
   * @enum {string}
   */
  PrintTicketStore.EventType = {
    CAPABILITIES_CHANGE: 'print_preview.PrintTicketStore.CAPABILITIES_CHANGE',
    DOCUMENT_CHANGE: 'print_preview.PrintTicketStore.DOCUMENT_CHANGE',
    INITIALIZE: 'print_preview.PrintTicketStore.INITIALIZE',
    TICKET_CHANGE: 'print_preview.PrintTicketStore.TICKET_CHANGE'
  };

  PrintTicketStore.prototype = {
    __proto__: cr.EventTarget.prototype,

    /**
     * Whether the print preview has been initialized.
     * @type {boolean}
     */
    get isInitialized() {
      return this.isInitialized_;
    },

    get collate() {
      return this.collate_;
    },

    get color() {
      return this.color_;
    },

    get copies() {
      return this.copies_;
    },

    get cssBackground() {
      return this.cssBackground_;
    },

    get customMargins() {
      return this.customMargins_;
    },

    get dpi() {
      return this.dpi_;
    },

    get duplex() {
      return this.duplex_;
    },

    get fitToPage() {
      return this.fitToPage_;
    },

    get headerFooter() {
      return this.headerFooter_;
    },

    get mediaSize() {
      return this.mediaSize_;
    },

    get landscape() {
      return this.landscape_;
    },

    get marginsType() {
      return this.marginsType_;
    },

    get pageRange() {
      return this.pageRange_;
    },

    get selectionOnly() {
      return this.selectionOnly_;
    },

    get vendorItems() {
      return this.vendorItems_;
    },

    /**
     * @return {!print_preview.MeasurementSystem} Measurement system of the
     *     local system.
     */
    get measurementSystem() {
      return this.measurementSystem_;
    },

    /**
     * Initializes the print ticket store. Dispatches an INITIALIZE event.
     * @param {string} thousandsDelimeter Delimeter of the thousands place.
     * @param {string} decimalDelimeter Delimeter of the decimal point.
     * @param {!print_preview.MeasurementSystem.UnitType} unitType Type of unit
     *     of the local measurement system.
     * @param {boolean} selectionOnly Whether only selected content should be
     *     printed.
     */
    init: function(
        thousandsDelimeter, decimalDelimeter, unitType, selectionOnly) {
      this.measurementSystem_.setSystem(thousandsDelimeter, decimalDelimeter,
                                        unitType);
      this.selectionOnly_.updateValue(selectionOnly);

      // Initialize ticket with user's previous values.
      if (this.appState_.hasField(
          print_preview.AppState.Field.IS_COLOR_ENABLED)) {
        this.color_.updateValue(
            /** @type {!Object} */(this.appState_.getField(
            print_preview.AppState.Field.IS_COLOR_ENABLED)));
      }
      if (this.appState_.hasField(print_preview.AppState.Field.DPI)) {
        this.dpi_.updateValue(
            /** @type {!Object} */(this.appState_.getField(
            print_preview.AppState.Field.DPI)));
      }
      if (this.appState_.hasField(
          print_preview.AppState.Field.IS_DUPLEX_ENABLED)) {
        this.duplex_.updateValue(
            /** @type {!Object} */(this.appState_.getField(
            print_preview.AppState.Field.IS_DUPLEX_ENABLED)));
      }
      if (this.appState_.hasField(print_preview.AppState.Field.MEDIA_SIZE)) {
        this.mediaSize_.updateValue(
            /** @type {!Object} */(this.appState_.getField(
            print_preview.AppState.Field.MEDIA_SIZE)));
      }
      if (this.appState_.hasField(
          print_preview.AppState.Field.IS_LANDSCAPE_ENABLED)) {
        this.landscape_.updateValue(
            /** @type {!Object} */(this.appState_.getField(
            print_preview.AppState.Field.IS_LANDSCAPE_ENABLED)));
      }
      // Initialize margins after landscape because landscape may reset margins.
      if (this.appState_.hasField(print_preview.AppState.Field.MARGINS_TYPE)) {
        this.marginsType_.updateValue(
            /** @type {!Object} */(this.appState_.getField(
            print_preview.AppState.Field.MARGINS_TYPE)));
      }
      if (this.appState_.hasField(
          print_preview.AppState.Field.CUSTOM_MARGINS)) {
        this.customMargins_.updateValue(
            /** @type {!Object} */(this.appState_.getField(
            print_preview.AppState.Field.CUSTOM_MARGINS)));
      }
      if (this.appState_.hasField(
          print_preview.AppState.Field.IS_HEADER_FOOTER_ENABLED)) {
        this.headerFooter_.updateValue(
            /** @type {!Object} */(this.appState_.getField(
            print_preview.AppState.Field.IS_HEADER_FOOTER_ENABLED)));
      }
      if (this.appState_.hasField(
          print_preview.AppState.Field.IS_COLLATE_ENABLED)) {
        this.collate_.updateValue(
            /** @type {!Object} */(this.appState_.getField(
            print_preview.AppState.Field.IS_COLLATE_ENABLED)));
      }
      if (this.appState_.hasField(
          print_preview.AppState.Field.IS_FIT_TO_PAGE_ENABLED)) {
        this.fitToPage_.updateValue(
            /** @type {!Object} */(this.appState_.getField(
            print_preview.AppState.Field.IS_FIT_TO_PAGE_ENABLED)));
      }
      if (this.appState_.hasField(
          print_preview.AppState.Field.IS_CSS_BACKGROUND_ENABLED)) {
        this.cssBackground_.updateValue(
            /** @type {!Object} */(this.appState_.getField(
            print_preview.AppState.Field.IS_CSS_BACKGROUND_ENABLED)));
      }
      if (this.appState_.hasField(
          print_preview.AppState.Field.VENDOR_OPTIONS)) {
        this.vendorItems_.updateValue(
            /** @type {!Object<string>} */(this.appState_.getField(
            print_preview.AppState.Field.VENDOR_OPTIONS)));
    }
    },

    /**
     * @return {boolean} {@code true} if the stored print ticket is valid,
     *     {@code false} otherwise.
     */
    isTicketValid: function() {
      return this.isTicketValidForPreview() &&
          (!this.copies_.isCapabilityAvailable() || this.copies_.isValid()) &&
          (!this.pageRange_.isCapabilityAvailable() ||
              this.pageRange_.isValid());
    },

    /** @return {boolean} Whether the ticket is valid for preview generation. */
    isTicketValidForPreview: function() {
      return (!this.marginsType_.isCapabilityAvailable() ||
              !this.marginsType_.isValueEqual(
                  print_preview.ticket_items.MarginsType.Value.CUSTOM) ||
              this.customMargins_.isValid());
    },

    /**
     * Creates an object that represents a Google Cloud Print print ticket.
     * @param {!print_preview.Destination} destination Destination to print to.
     * @return {!Object} Google Cloud Print print ticket.
     */
    createPrintTicket: function(destination) {
      assert(!destination.isLocal ||
             destination.isPrivet || destination.isExtension,
             'Trying to create a Google Cloud Print print ticket for a local ' +
                 ' non-privet and non-extension destination');

      assert(destination.capabilities,
             'Trying to create a Google Cloud Print print ticket for a ' +
                 'destination with no print capabilities');
      var cjt = {
        version: '1.0',
        print: {}
      };
      if (this.collate.isCapabilityAvailable() && this.collate.isUserEdited()) {
        cjt.print.collate = {collate: this.collate.getValue()};
      }
      if (this.color.isCapabilityAvailable() && this.color.isUserEdited()) {
        var selectedOption = this.color.getSelectedOption();
        if (!selectedOption) {
          console.error('Could not find correct color option');
        } else {
          cjt.print.color = {type: selectedOption.type};
          if (selectedOption.hasOwnProperty('vendor_id')) {
            cjt.print.color.vendor_id = selectedOption.vendor_id;
          }
        }
      }
      if (this.copies.isCapabilityAvailable() && this.copies.isUserEdited()) {
        cjt.print.copies = {copies: this.copies.getValueAsNumber()};
      }
      if (this.duplex.isCapabilityAvailable() && this.duplex.isUserEdited()) {
        cjt.print.duplex =
            {type: this.duplex.getValue() ? 'LONG_EDGE' : 'NO_DUPLEX'};
      }
      if (this.mediaSize.isCapabilityAvailable()) {
        var value = this.mediaSize.getValue();
        cjt.print.media_size = {
          width_microns: value.width_microns,
          height_microns: value.height_microns,
          is_continuous_feed: value.is_continuous_feed,
          vendor_id: value.vendor_id
        };
      }
      if (!this.landscape.isCapabilityAvailable()) {
        // In this case "orientation" option is hidden from user, so user can't
        // adjust it for page content, see Landscape.isCapabilityAvailable().
        // We can improve results if we set AUTO here.
        if (this.landscape.hasOption('AUTO'))
          cjt.print.page_orientation = { type: 'AUTO' };
      } else if (this.landscape.isUserEdited()) {
        cjt.print.page_orientation =
            {type: this.landscape.getValue() ? 'LANDSCAPE' : 'PORTRAIT'};
      }
      if (this.dpi.isCapabilityAvailable()) {
        var value = this.dpi.getValue();
        cjt.print.dpi = {
          horizontal_dpi: value.horizontal_dpi,
          vertical_dpi: value.vertical_dpi,
          vendor_id: value.vendor_id
        };
      }
      if (this.vendorItems.isCapabilityAvailable() &&
          this.vendorItems.isUserEdited()) {
        var items = this.vendorItems.ticketItems;
        cjt.print.vendor_ticket_item = [];
        for (var itemId in items) {
          if (items.hasOwnProperty(itemId)) {
            cjt.print.vendor_ticket_item.push(
                {id: itemId, value: items[itemId]});
          }
        }
      }
      return JSON.stringify(cjt);
    },

    /**
     * Adds event listeners for the print ticket store.
     * @private
     */
    addEventListeners_: function() {
      this.tracker_.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.DESTINATION_SELECT,
          this.onDestinationSelect_.bind(this));

      this.tracker_.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.
              SELECTED_DESTINATION_CAPABILITIES_READY,
          this.onSelectedDestinationCapabilitiesReady_.bind(this));

      this.tracker_.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.
              CACHED_SELECTED_DESTINATION_INFO_READY,
          this.onSelectedDestinationCapabilitiesReady_.bind(this));

      // TODO(rltoscano): Print ticket store shouldn't be re-dispatching these
      // events, the consumers of the print ticket store events should listen
      // for the events from document info instead. Will move this when
      // consumers are all migrated.
      this.tracker_.add(
          this.documentInfo_,
          print_preview.DocumentInfo.EventType.CHANGE,
          this.onDocumentInfoChange_.bind(this));
    },

    /**
     * Called when the destination selected.
     * @private
     */
    onDestinationSelect_: function() {
      // Reset user selection for certain ticket items.
      if (this.capabilitiesHolder_.get() != null) {
        this.customMargins_.updateValue(null);
        if (this.marginsType_.getValue() ==
            print_preview.ticket_items.MarginsType.Value.CUSTOM) {
          this.marginsType_.updateValue(
              print_preview.ticket_items.MarginsType.Value.DEFAULT);
        }
        this.vendorItems_.updateValue({});
      }
    },

    /**
     * Called when the capabilities of the selected destination are ready.
     * @private
     */
    onSelectedDestinationCapabilitiesReady_: function() {
      var caps = assert(
          this.destinationStore_.selectedDestination.capabilities);
      var isFirstUpdate = this.capabilitiesHolder_.get() == null;
      this.capabilitiesHolder_.set(caps);
      if (isFirstUpdate) {
        this.isInitialized_ = true;
        cr.dispatchSimpleEvent(this, PrintTicketStore.EventType.INITIALIZE);
      } else {
        cr.dispatchSimpleEvent(
            this, PrintTicketStore.EventType.CAPABILITIES_CHANGE);
      }
    },

    /**
     * Called when document data model has changed. Dispatches a print ticket
     * store event.
     * @private
     */
    onDocumentInfoChange_: function() {
      cr.dispatchSimpleEvent(this, PrintTicketStore.EventType.DOCUMENT_CHANGE);
    },
  };

  // Export
  return {
    PrintTicketStore: PrintTicketStore
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Immutable two dimensional point in space. The units of the dimensions are
   * undefined.
   * @param {number} x X-dimension of the point.
   * @param {number} y Y-dimension of the point.
   * @constructor
   */
  function Coordinate2d(x, y) {
    /**
     * X-dimension of the point.
     * @type {number}
     * @private
     */
    this.x_ = x;

    /**
     * Y-dimension of the point.
     * @type {number}
     * @private
     */
    this.y_ = y;
  };

  Coordinate2d.prototype = {
    /** @return {number} X-dimension of the point. */
    get x() {
      return this.x_;
    },

    /** @return {number} Y-dimension of the point. */
    get y() {
      return this.y_;
    },

    /**
     * @param {number} x Amount to translate in the X dimension.
     * @param {number} y Amount to translate in the Y dimension.
     * @return {!print_preview.Coordinate2d} A new two-dimensional point
     *     translated along the X and Y dimensions.
     */
    translate: function(x, y) {
      return new Coordinate2d(this.x_ + x, this.y_ + y);
    },

    /**
     * @param {number} factor Amount to scale the X and Y dimensions.
     * @return {!print_preview.Coordinate2d} A new two-dimensional point scaled
     *     by the given factor.
     */
    scale: function(factor) {
      return new Coordinate2d(this.x_ * factor, this.y_ * factor);
    },

    /**
     * @param {print_preview.Coordinate2d} other The point to compare against.
     * @return {boolean} Whether another point is equal to this one.
     */
    equals: function(other) {
      return other != null &&
          this.x_ == other.x_ &&
          this.y_ == other.y_;
    }
  };

  // Export
  return {
    Coordinate2d: Coordinate2d
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Immutable two-dimensional size.
   * @param {number} width Width of the size.
   * @param {number} height Height of the size.
   * @constructor
   */
  function Size(width, height) {
    /**
     * Width of the size.
     * @type {number}
     * @private
     */
    this.width_ = width;

    /**
     * Height of the size.
     * @type {number}
     * @private
     */
    this.height_ = height;
  };

  Size.prototype = {
    /** @return {number} Width of the size. */
    get width() {
      return this.width_;
    },

    /** @return {number} Height of the size. */
    get height() {
      return this.height_;
    },

    /**
     * @param {print_preview.Size} other Other size object to compare against.
     * @return {boolean} Whether this size object is equal to another.
     */
    equals: function(other) {
      return other != null &&
          this.width_ == other.width_ &&
          this.height_ == other.height_;
    }
  };

  // Export
  return {
    Size: Size
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Mutable reference to a CDD object.
   * @constructor
   */
  function CapabilitiesHolder() {
    /**
     * Reference to the capabilities object.
     * @type {?print_preview.Cdd}
     * @private
     */
    this.capabilities_ = null;
  };

  CapabilitiesHolder.prototype = {
    /** @return {?print_preview.Cdd} The instance held by the holder. */
    get: function() {
      return this.capabilities_;
    },

    /**
     * @param {!print_preview.Cdd} capabilities New instance to put into the
     *     holder.
     */
    set: function(capabilities) {
      this.capabilities_ = capabilities;
    }
  };

  // Export
  return {
    CapabilitiesHolder: CapabilitiesHolder
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Repository which stores information about the user. Events are dispatched
   * when the information changes.
   * @constructor
   * @extends {cr.EventTarget}
   */
  function UserInfo() {
    cr.EventTarget.call(this);

    /**
     * Email address of the logged in user or {@code null} if no user is logged
     * in. In case of Google multilogin, can be changed by the user.
     * @private {?string}
     */
    this.activeUser_ = null;

    /**
     * Email addresses of the logged in users or empty array if no user is
     * logged in. {@code null} if not known yet.
     * @private {?Array<string>}
     */
    this.users_ = null;
  };

  /**
   * Enumeration of event types dispatched by the user info.
   * @enum {string}
   */
  UserInfo.EventType = {
    ACTIVE_USER_CHANGED: 'print_preview.UserInfo.ACTIVE_USER_CHANGED',
    USERS_CHANGED: 'print_preview.UserInfo.USERS_CHANGED'
  };

  UserInfo.prototype = {
    __proto__: cr.EventTarget.prototype,

    /** @return {boolean} Whether user accounts are already retrieved. */
    get initialized() {
      return this.users_ != null;
    },

    /** @return {boolean} Whether user is logged in or not. */
    get loggedIn() {
      return !!this.activeUser;
    },

    /**
     * @return {?string} Email address of the logged in user or {@code null} if
     *     no user is logged.
     */
    get activeUser() {
      return this.activeUser_;
    },

    /** Changes active user. */
    set activeUser(activeUser) {
      if (this.activeUser_ != activeUser) {
        this.activeUser_ = activeUser;
        cr.dispatchSimpleEvent(this, UserInfo.EventType.ACTIVE_USER_CHANGED);
      }
    },

    /**
     * @return {?Array<string>} Email addresses of the logged in users or
     *     empty array if no user is logged in. {@code null} if not known yet.
     */
    get users() {
      return this.users_;
    },

    /**
     * Sets logged in user accounts info.
     * @param {string} activeUser Active user account (email).
     * @param {!Array<string>} users List of currently logged in accounts.
     */
    setUsers: function(activeUser, users) {
      this.activeUser_ = activeUser;
      this.users_ = users || [];
      cr.dispatchSimpleEvent(this, UserInfo.EventType.USERS_CHANGED);
    },
  };

  return {
    UserInfo: UserInfo
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Object used to represent a recent destination in the app state.
   * @constructor
   */
  function RecentDestination(destination) {
    /**
     * ID of the RecentDestination.
     * @type {string}
     */
    this.id = destination.id;

    /**
     * Origin of the RecentDestination.
     * @type {string}
     */
    this.origin = destination.origin;

    /**
     * Account the RecentDestination is registered for.
     * @type {string}
     */
    this.account = destination.account || '';

    /**
     * CDD of the RecentDestination.
     * @type {print_preview.Cdd}
     */
    this.capabilities = destination.capabilities;

    /**
     * Name of the RecentDestination.
     * @type {string}
     */
    this.name = destination.name || '';

    /**
     * Extension ID associated with the RecentDestination.
     * @type {string}
     */
    this.extensionId = destination.extension_id || '';

    /**
     * Extension name associated with the RecentDestination.
     * @type {string}
     */
    this.extensionName = destination.extension_name || '';
  };

  /**
   * Object used to get and persist the print preview application state.
   * @constructor
   */
  function AppState() {
    /**
     * Internal representation of application state.
     * @type {Object}
     * @private
     */
    this.state_ = {};
    this.state_[AppState.Field.VERSION] = AppState.VERSION_;
    this.state_[AppState.Field.IS_GCP_PROMO_DISMISSED] = true;
    this.state_[AppState.Field.RECENT_DESTINATIONS] = [];

    /**
     * Whether the app state has been initialized. The app state will ignore all
     * writes until it has been initialized.
     * @type {boolean}
     * @private
     */
    this.isInitialized_ = false;
  };

  /**
   * Number of recent print destinations to store across browser sessions.
   * @const {number}
   */
  AppState.NUM_DESTINATIONS_ = 3;


  /**
   * Enumeration of field names for serialized app state.
   * @enum {string}
   */
  AppState.Field = {
    VERSION: 'version',
    RECENT_DESTINATIONS: 'recentDestinations',
    IS_GCP_PROMO_DISMISSED: 'isGcpPromoDismissed',
    DPI: 'dpi',
    MEDIA_SIZE: 'mediaSize',
    MARGINS_TYPE: 'marginsType',
    CUSTOM_MARGINS: 'customMargins',
    IS_COLOR_ENABLED: 'isColorEnabled',
    IS_DUPLEX_ENABLED: 'isDuplexEnabled',
    IS_HEADER_FOOTER_ENABLED: 'isHeaderFooterEnabled',
    IS_LANDSCAPE_ENABLED: 'isLandscapeEnabled',
    IS_COLLATE_ENABLED: 'isCollateEnabled',
    IS_FIT_TO_PAGE_ENABLED: 'isFitToPageEnabled',
    IS_CSS_BACKGROUND_ENABLED: 'isCssBackgroundEnabled',
    VENDOR_OPTIONS: 'vendorOptions'
  };

  /**
   * Current version of the app state. This value helps to understand how to
   * parse earlier versions of the app state.
   * @type {number}
   * @const
   * @private
   */
  AppState.VERSION_ = 2;

  /**
   * Name of C++ layer function to persist app state.
   * @type {string}
   * @const
   * @private
   */
  AppState.NATIVE_FUNCTION_NAME_ = 'saveAppState';

  AppState.prototype = {
    /**
     * @return {?RecentDestination} The most recent destination, which is
     *     currently the selected destination.
     */
    get selectedDestination() {
      return (this.state_[AppState.Field.RECENT_DESTINATIONS].length > 0) ?
          this.state_[AppState.Field.RECENT_DESTINATIONS][0] : null;
    },

    /**
     * @return {?Array<!RecentDestination>} The AppState.NUM_DESTINATIONS_ most
     *     recent destinations.
     */
    get recentDestinations() {
      return this.state_[AppState.Field.RECENT_DESTINATIONS];
    },

    /** @return {boolean} Whether the GCP promotion has been dismissed. */
    get isGcpPromoDismissed() {
      return this.state_[AppState.Field.IS_GCP_PROMO_DISMISSED];
    },

    /**
     * @param {!print_preview.AppState.Field} field App state field to check if
     *     set.
     * @return {boolean} Whether a field has been set in the app state.
     */
    hasField: function(field) {
      return this.state_.hasOwnProperty(field);
    },

    /**
     * @param {!print_preview.AppState.Field} field App state field to get.
     * @return {?} Value of the app state field.
     */
    getField: function(field) {
      if (field == AppState.Field.CUSTOM_MARGINS) {
        return this.state_[field] ?
            print_preview.Margins.parse(this.state_[field]) : null;
      } else {
        return this.state_[field];
      }
    },

    /**
     * Initializes the app state from a serialized string returned by the native
     * layer.
     * @param {?string} serializedAppStateStr Serialized string representation
     *     of the app state.
     */
    init: function(serializedAppStateStr) {
      if (serializedAppStateStr) {
        try {
          var state = JSON.parse(serializedAppStateStr);
          if (state[AppState.Field.VERSION] == AppState.VERSION_) {
            this.state_ = state;
          }
        } catch(e) {
          console.error('Unable to parse state: ' + e);
          // Proceed with default state.
        }
      } else {
        // Set some state defaults.
        this.state_[AppState.Field.IS_GCP_PROMO_DISMISSED] = false;
        this.state_[AppState.Field.RECENT_DESTINATIONS] = [];
      }
      if (!this.state_[AppState.Field.RECENT_DESTINATIONS]) {
        this.state_[AppState.Field.RECENT_DESTINATIONS] = [];
      } else if (!(this.state_[AppState.Field.RECENT_DESTINATIONS] instanceof
            Array)) {
        var tmp = this.state_[AppState.Field.RECENT_DESTINATIONS];
        this.state_[AppState.Field.RECENT_DESTINATIONS] = [tmp];
      } else if (!this.state_[AppState.Field.RECENT_DESTINATIONS][0] ||
          !this.state_[AppState.Field.RECENT_DESTINATIONS][0].id) {
        // read in incorrectly
        this.state_[AppState.Field.RECENT_DESTINATIONS] = [];
      } else if (this.state_[AppState.Field.RECENT_DESTINATIONS].length >
          AppState.NUM_DESTINATIONS_) {
        this.state_[AppState.Field.RECENT_DESTINATIONS].length =
            AppState.NUM_DESTINATIONS_;
      }
    },

    /**
     * Sets to initialized state. Now object will accept persist requests.
     */
    setInitialized: function() {
      this.isInitialized_ = true;
    },

    /**
     * Persists the given value for the given field.
     * @param {!print_preview.AppState.Field} field Field to persist.
     * @param {?} value Value of field to persist.
     */
    persistField: function(field, value) {
      if (!this.isInitialized_)
        return;
      if (field == AppState.Field.CUSTOM_MARGINS) {
        this.state_[field] = value ? value.serialize() : null;
      } else {
        this.state_[field] = value;
      }
      this.persist_();
    },

    /**
     * Persists the selected destination.
     * @param {!print_preview.Destination} dest Destination to persist.
     */
    persistSelectedDestination: function(dest) {
      if (!this.isInitialized_)
        return;

      // Determine if this destination is already in the recent destinations,
      // and where in the array it is located.
      var newDestination = new RecentDestination(dest);
      var indexFound = this.state_[
          AppState.Field.RECENT_DESTINATIONS].findIndex(function(recent) {
            return (newDestination.id == recent.id &&
                    newDestination.origin == recent.origin);
          });

      // No change
      if (indexFound == 0) {
        this.persist_();
        return;
      }

      // Shift the array so that the nth most recent destination is located at
      // index n.
      if (indexFound == -1 &&
          this.state_[AppState.Field.RECENT_DESTINATIONS].length ==
          AppState.NUM_DESTINATIONS_) {
        indexFound = AppState.NUM_DESTINATIONS_ - 1;
      }
      if (indexFound != -1)
        this.state_[AppState.Field.RECENT_DESTINATIONS].splice(indexFound, 1);

      // Add the most recent destination
      this.state_[AppState.Field.RECENT_DESTINATIONS].splice(
          0, 0, newDestination);

      this.persist_();
    },

    /**
     * Persists whether the GCP promotion has been dismissed.
     * @param {boolean} isGcpPromoDismissed Whether the GCP promotion has been
     *     dismissed.
     */
    persistIsGcpPromoDismissed: function(isGcpPromoDismissed) {
      if (!this.isInitialized_)
        return;
      this.state_[AppState.Field.IS_GCP_PROMO_DISMISSED] = isGcpPromoDismissed;
      this.persist_();
    },

    /**
     * Calls into the native layer to persist the application state.
     * @private
     */
    persist_: function() {
      chrome.send(AppState.NATIVE_FUNCTION_NAME_,
                  [JSON.stringify(this.state_)]);
    }
  };

  return {
    AppState: AppState
  };
});


// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview.ticket_items', function() {
  'use strict';

  /**
   * An object that represents a user modifiable item in a print ticket. Each
   * ticket item has a value which can be set by the user. Ticket items can also
   * be unavailable for modifying if the print destination doesn't support it or
   * if other ticket item constraints are not met.
   * @param {?print_preview.AppState} appState Application state model to update
   *     when ticket items update.
   * @param {?print_preview.AppState.Field} field Field of the app state to
   *     update when ticket item is updated.
   * @param {?print_preview.DestinationStore} destinationStore Used listen for
   *     changes in the currently selected destination's capabilities. Since
   *     this is a common dependency of ticket items, it's handled in the base
   *     class.
   * @param {?print_preview.DocumentInfo=} opt_documentInfo Used to listen for
   *     changes in the document. Since this is a common dependency of ticket
   *     items, it's handled in the base class.
   * @constructor
   * @extends {cr.EventTarget}
   */
  function TicketItem(appState, field, destinationStore, opt_documentInfo) {
    cr.EventTarget.call(this);

    /**
     * Application state model to update when ticket items update.
     * @type {print_preview.AppState}
     * @private
     */
    this.appState_ = appState || null;

    /**
     * Field of the app state to update when ticket item is updated.
     * @type {?print_preview.AppState.Field}
     * @private
     */
    this.field_ = field || null;

    /**
     * Used listen for changes in the currently selected destination's
     * capabilities.
     * @type {print_preview.DestinationStore}
     * @private
     */
    this.destinationStore_ = destinationStore || null;

    /**
     * Used to listen for changes in the document.
     * @type {print_preview.DocumentInfo}
     * @private
     */
    this.documentInfo_ = opt_documentInfo || null;

    /**
     * Backing store of the print ticket item.
     * @type {Object}
     * @private
     */
    this.value_ = null;

    /**
     * Keeps track of event listeners for the ticket item.
     * @type {!EventTracker}
     * @private
     */
    this.tracker_ = new EventTracker();

    this.addEventHandlers_();
  };

  /**
   * Event types dispatched by this class.
   * @enum {string}
   */
  TicketItem.EventType = {
    CHANGE: 'print_preview.ticket_items.TicketItem.CHANGE'
  };

  TicketItem.prototype = {
    __proto__: cr.EventTarget.prototype,

    /**
     * Determines whether a given value is valid for the ticket item.
     * @param {?} value The value to check for validity.
     * @return {boolean} Whether the given value is valid for the ticket item.
     */
    wouldValueBeValid: function(value) {
      throw Error('Abstract method not overridden');
    },

    /**
     * @return {boolean} Whether the print destination capability is available.
     */
    isCapabilityAvailable: function() {
      throw Error('Abstract method not overridden');
    },

    /** @return {!Object} The value of the ticket item. */
    getValue: function() {
      if (this.isCapabilityAvailable()) {
        if (this.value_ == null) {
          return this.getDefaultValueInternal();
        } else {
          return this.value_;
        }
      } else {
        return this.getCapabilityNotAvailableValueInternal();
      }
    },

    /** @return {boolean} Whether the ticket item was modified by the user. */
    isUserEdited: function() {
      return this.value_ != null;
    },

    /** @return {boolean} Whether the ticket item's value is valid. */
    isValid: function() {
      if (!this.isUserEdited()) {
        return true;
      }
      return this.wouldValueBeValid(this.value_);
    },

    /**
     * @param {?} value Value to compare to the value of this ticket item.
     * @return {boolean} Whether the given value is equal to the value of the
     *     ticket item.
     */
    isValueEqual: function(value) {
      return this.getValue() == value;
    },

    /**
     * @param {?} value Value to set as the value of the ticket item.
     */
    updateValue: function(value) {
      // Use comparison with capabilities for event.
      var sendUpdateEvent = !this.isValueEqual(value);
      // Don't lose requested value if capability is not available.
      this.updateValueInternal(value);
      if (this.appState_) {
        this.appState_.persistField(this.field_, value);
      }
      if (sendUpdateEvent)
        cr.dispatchSimpleEvent(this, TicketItem.EventType.CHANGE);
    },

    /**
     * @return {?} Default value of the ticket item if no value was set by
     *     the user.
     * @protected
     */
    getDefaultValueInternal: function() {
      throw Error('Abstract method not overridden');
    },

    /**
     * @return {?} Default value of the ticket item if the capability is
     *     not available.
     * @protected
     */
    getCapabilityNotAvailableValueInternal: function() {
      throw Error('Abstract method not overridden');
    },

    /**
     * @return {!EventTracker} Event tracker to keep track of events from
     *     dependencies.
     * @protected
     */
    getTrackerInternal: function() {
      return this.tracker_;
    },

    /**
     * @return {print_preview.Destination} Selected destination from the
     *     destination store, or {@code null} if no destination is selected.
     * @protected
     */
    getSelectedDestInternal: function() {
      return this.destinationStore_ ?
          this.destinationStore_.selectedDestination : null;
    },

    /**
     * @return {print_preview.DocumentInfo} Document data model.
     * @protected
     */
    getDocumentInfoInternal: function() {
      return this.documentInfo_;
    },

    /**
     * Dispatches a CHANGE event.
     * @protected
     */
    dispatchChangeEventInternal: function() {
      cr.dispatchSimpleEvent(
          this, print_preview.ticket_items.TicketItem.EventType.CHANGE);
    },

    /**
     * Updates the value of the ticket item without dispatching any events or
     * persisting the value.
     * @protected
     */
    updateValueInternal: function(value) {
      this.value_ = value;
    },

    /**
     * Adds event handlers for this class.
     * @private
     */
    addEventHandlers_: function() {
      if (this.destinationStore_) {
        this.tracker_.add(
            this.destinationStore_,
            print_preview.DestinationStore.EventType.
                SELECTED_DESTINATION_CAPABILITIES_READY,
            this.dispatchChangeEventInternal.bind(this));
      }
      if (this.documentInfo_) {
        this.tracker_.add(
            this.documentInfo_,
            print_preview.DocumentInfo.EventType.CHANGE,
            this.dispatchChangeEventInternal.bind(this));
      }
    },
  };

  // Export
  return {
    TicketItem: TicketItem
  };
});


// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview.ticket_items', function() {
  'use strict';

  /**
   * Custom page margins ticket item whose value is a
   * {@code print_preview.Margins}.
   * @param {!print_preview.AppState} appState App state used to persist custom
   *     margins.
   * @param {!print_preview.DocumentInfo} documentInfo Information about the
   *     document to print.
   * @constructor
   * @extends {print_preview.ticket_items.TicketItem}
   */
  function CustomMargins(appState, documentInfo) {
    print_preview.ticket_items.TicketItem.call(
        this,
        appState,
        print_preview.AppState.Field.CUSTOM_MARGINS,
        null /*destinationStore*/,
        documentInfo);
  };

  /**
   * Enumeration of the orientations of margins.
   * @enum {string}
   */
  CustomMargins.Orientation = {
    TOP: 'top',
    RIGHT: 'right',
    BOTTOM: 'bottom',
    LEFT: 'left'
  };

  /**
   * Mapping of a margin orientation to its opposite.
   * @type {!Object<!print_preview.ticket_items.CustomMargins.Orientation,
   *                 !print_preview.ticket_items.CustomMargins.Orientation>}
   * @private
   */
  CustomMargins.OppositeOrientation_ = {};
  CustomMargins.OppositeOrientation_[CustomMargins.Orientation.TOP] =
      CustomMargins.Orientation.BOTTOM;
  CustomMargins.OppositeOrientation_[CustomMargins.Orientation.RIGHT] =
      CustomMargins.Orientation.LEFT;
  CustomMargins.OppositeOrientation_[CustomMargins.Orientation.BOTTOM] =
      CustomMargins.Orientation.TOP;
  CustomMargins.OppositeOrientation_[CustomMargins.Orientation.LEFT] =
      CustomMargins.Orientation.RIGHT;

  /**
   * Minimum distance in points that two margins can be separated by.
   * @type {number}
   * @const
   * @private
   */
  CustomMargins.MINIMUM_MARGINS_DISTANCE_ = 72; // 1 inch.

  CustomMargins.prototype = {
    __proto__: print_preview.ticket_items.TicketItem.prototype,

    /** @override */
    wouldValueBeValid: function(value) {
      var margins = /** @type {!print_preview.Margins} */ (value);
      for (var key in CustomMargins.Orientation) {
        var o = CustomMargins.Orientation[key];
        var max = this.getMarginMax_(
            o, margins.get(CustomMargins.OppositeOrientation_[o]));
        if (margins.get(o) > max || margins.get(o) < 0) {
          return false;
        }
      }
      return true;
    },

    /** @override */
    isCapabilityAvailable: function() {
      return this.getDocumentInfoInternal().isModifiable;
    },

    /** @override */
    isValueEqual: function(value) {
      return this.getValue().equals(value);
    },

    /**
     * @param {!print_preview.ticket_items.CustomMargins.Orientation}
     *     orientation Specifies the margin to get the maximum value for.
     * @return {number} Maximum value in points of the specified margin.
     */
    getMarginMax: function(orientation) {
      var oppositeOrient = CustomMargins.OppositeOrientation_[orientation];
      var margins = /** @type {!print_preview.Margins} */ (this.getValue());
      return this.getMarginMax_(orientation, margins.get(oppositeOrient));
    },

    /** @override */
    updateValue: function(value) {
      var margins = /** @type {!print_preview.Margins} */ (value);
      if (margins != null) {
        margins = new print_preview.Margins(
            Math.round(margins.get(CustomMargins.Orientation.TOP)),
            Math.round(margins.get(CustomMargins.Orientation.RIGHT)),
            Math.round(margins.get(CustomMargins.Orientation.BOTTOM)),
            Math.round(margins.get(CustomMargins.Orientation.LEFT)));
      }
      print_preview.ticket_items.TicketItem.prototype.updateValue.call(
          this, margins);
    },

    /**
     * Updates the specified margin in points while keeping the value within
     * a maximum and minimum.
     * @param {!print_preview.ticket_items.CustomMargins.Orientation}
     *     orientation Specifies the margin to update.
     * @param {number} value Updated margin value in points.
     */
    updateMargin: function(orientation, value) {
      var margins = /** @type {!print_preview.Margins} */ (this.getValue());
      var oppositeOrientation = CustomMargins.OppositeOrientation_[orientation];
      var max =
          this.getMarginMax_(orientation, margins.get(oppositeOrientation));
      value = Math.max(0, Math.min(max, value));
      this.updateValue(margins.set(orientation, value));
    },

    /** @override */
    getDefaultValueInternal: function() {
      return this.getDocumentInfoInternal().margins ||
             new print_preview.Margins(72, 72, 72, 72);
    },

    /** @override */
    getCapabilityNotAvailableValueInternal: function() {
      return this.getDocumentInfoInternal().margins ||
             new print_preview.Margins(72, 72, 72, 72);
    },

    /**
     * @param {!print_preview.ticket_items.CustomMargins.Orientation}
     *     orientation Specifies which margin to get the maximum value of.
     * @param {number} oppositeMargin Value of the margin in points
     *     opposite the specified margin.
     * @return {number} Maximum value in points of the specified margin.
     * @private
     */
    getMarginMax_: function(orientation, oppositeMargin) {
      var max;
      if (orientation == CustomMargins.Orientation.TOP ||
          orientation == CustomMargins.Orientation.BOTTOM) {
        max = this.getDocumentInfoInternal().pageSize.height - oppositeMargin -
            CustomMargins.MINIMUM_MARGINS_DISTANCE_;
      } else {
        max = this.getDocumentInfoInternal().pageSize.width - oppositeMargin -
            CustomMargins.MINIMUM_MARGINS_DISTANCE_;
      }
      return Math.round(max);
    }
  };

  // Export
  return {
    CustomMargins: CustomMargins
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview.ticket_items', function() {
  'use strict';

  /**
   * Collate ticket item whose value is a {@code boolean} that indicates whether
   * collation is enabled.
   * @param {!print_preview.AppState} appState App state used to persist collate
   *     selection.
   * @param {!print_preview.DestinationStore} destinationStore Destination store
   *     used determine if a destination has the collate capability.
   * @constructor
   * @extends {print_preview.ticket_items.TicketItem}
   */
  function Collate(appState, destinationStore) {
    print_preview.ticket_items.TicketItem.call(
        this,
        appState,
        print_preview.AppState.Field.IS_COLLATE_ENABLED,
        destinationStore);
  };

  Collate.prototype = {
    __proto__: print_preview.ticket_items.TicketItem.prototype,

    /** @override */
    wouldValueBeValid: function(value) {
      return true;
    },

    /** @override */
    isCapabilityAvailable: function() {
      return !!this.getCollateCapability_();
    },

    /** @override */
    getDefaultValueInternal: function() {
      var capability = this.getCollateCapability_();
      return capability.hasOwnProperty('default') ? capability.default : true;
    },

    /** @override */
    getCapabilityNotAvailableValueInternal: function() {
      return true;
    },

    /**
     * @return {Object} Collate capability of the selected destination.
     * @private
     */
    getCollateCapability_: function() {
      var dest = this.getSelectedDestInternal();
      return (dest &&
              dest.capabilities &&
              dest.capabilities.printer &&
              dest.capabilities.printer.collate) ||
             null;
    }
  };

  // Export
  return {
    Collate: Collate
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview.ticket_items', function() {
  'use strict';

  /**
   * Color ticket item whose value is a {@code boolean} that indicates whether
   * the document should be printed in color.
   * @param {!print_preview.AppState} appState App state persistence object to
   *     save the state of the color selection.
   * @param {!print_preview.DestinationStore} destinationStore Used to determine
   *     whether color printing should be available.
   * @constructor
   * @extends {print_preview.ticket_items.TicketItem}
   */
  function Color(appState, destinationStore) {
    print_preview.ticket_items.TicketItem.call(
        this,
        appState,
        print_preview.AppState.Field.IS_COLOR_ENABLED,
        destinationStore);
  };

  /**
   * @private {!Array<string>} List of capability types considered color.
   * @const
   */
  Color.COLOR_TYPES_ = ['STANDARD_COLOR', 'CUSTOM_COLOR'];

  /**
   * @private {!Array<string>} List of capability types considered monochrome.
   * @const
   */
  Color.MONOCHROME_TYPES_ = ['STANDARD_MONOCHROME', 'CUSTOM_MONOCHROME'];

  Color.prototype = {
    __proto__: print_preview.ticket_items.TicketItem.prototype,

    /** @override */
    wouldValueBeValid: function(value) {
      return true;
    },

    /** @override */
    isCapabilityAvailable: function() {
      var capability = this.capability;
      if (!capability) {
        return false;
      }
      var hasColor = false;
      var hasMonochrome = false;
      capability.option.forEach(function(option) {
        hasColor = hasColor || (Color.COLOR_TYPES_.indexOf(option.type) >= 0);
        hasMonochrome = hasMonochrome ||
            (Color.MONOCHROME_TYPES_.indexOf(option.type) >= 0);
      });
      return hasColor && hasMonochrome;
    },

    /** @return {Object} Color capability of the selected destination. */
    get capability() {
      var dest = this.getSelectedDestInternal();
      return (dest &&
              dest.capabilities &&
              dest.capabilities.printer &&
              dest.capabilities.printer.color) ||
             null;
    },

    /** @return {Object} Color option corresponding to the current value. */
    getSelectedOption: function() {
      var capability = this.capability;
      var options = capability ? capability.option : null;
      if (options) {
        var typesToLookFor =
            this.getValue() ? Color.COLOR_TYPES_ : Color.MONOCHROME_TYPES_;
        for (var i = 0; i < typesToLookFor.length; i++) {
          var matchingOptions = options.filter(function(option) {
            return option.type == typesToLookFor[i];
          });
          if (matchingOptions.length > 0) {
            return matchingOptions[0];
          }
        }
      }
      return null;
    },

    /** @override */
    getDefaultValueInternal: function() {
      var capability = this.capability;
      var defaultOption = capability ?
          this.getDefaultColorOption_(capability.option) : null;
      return defaultOption &&
          (Color.COLOR_TYPES_.indexOf(defaultOption.type) >= 0);
    },

    /** @override */
    getCapabilityNotAvailableValueInternal: function() {
      // TODO(rltoscano): Get rid of this check based on destination ID. These
      // destinations should really update their CDDs to have only one color
      // option that has type 'STANDARD_COLOR'.
      var dest = this.getSelectedDestInternal();
      if (dest) {
        if (dest.id == print_preview.Destination.GooglePromotedId.DOCS ||
            dest.id == print_preview.Destination.GooglePromotedId.FEDEX ||
            dest.type == print_preview.Destination.Type.MOBILE) {
          return true;
        }
      }
      return this.getDefaultValueInternal();
    },

    /**
     * @param {!Array<!Object<{type: (string|undefined),
     *                           is_default: (boolean|undefined)}>>} options
     * @return {Object<{type: (string|undefined),
     *                   is_default: (boolean|undefined)}>} Default color
     *     option of the given list.
     * @private
     */
    getDefaultColorOption_: function(options) {
      var defaultOptions = options.filter(function(option) {
        return option.is_default;
      });
      return (defaultOptions.length == 0) ? null : defaultOptions[0];
    }
  };

  // Export
  return {
    Color: Color
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview.ticket_items', function() {
  'use strict';

  /**
   * Copies ticket item whose value is a {@code string} that indicates how many
   * copies of the document should be printed. The ticket item is backed by a
   * string since the user can textually input the copies value.
   * @param {!print_preview.DestinationStore} destinationStore Destination store
   *     used determine if a destination has the copies capability.
   * @constructor
   * @extends {print_preview.ticket_items.TicketItem}
   */
  function Copies(destinationStore) {
    print_preview.ticket_items.TicketItem.call(
        this, null /*appState*/, null /*field*/, destinationStore);
  };

  Copies.prototype = {
    __proto__: print_preview.ticket_items.TicketItem.prototype,

    /** @override */
    wouldValueBeValid: function(value) {
      if (/[^\d]+/.test(value)) {
        return false;
      }
      var copies = parseInt(value, 10);
      if (copies > 999 || copies < 1) {
        return false;
      }
      return true;
    },

    /** @override */
    isCapabilityAvailable: function() {
      return !!this.getCopiesCapability_();
    },

    /** @return {number} The number of copies indicated by the ticket item. */
    getValueAsNumber: function() {
      return parseInt(this.getValue(), 10);
    },

    /** @override */
    getDefaultValueInternal: function() {
      var cap = this.getCopiesCapability_();
      return cap.hasOwnProperty('default') ? cap.default : '1';
    },

    /** @override */
    getCapabilityNotAvailableValueInternal: function() {
      return '1';
    },

    /**
     * @return {Object} Copies capability of the selected destination.
     * @private
     */
    getCopiesCapability_: function() {
      var dest = this.getSelectedDestInternal();
      return (dest &&
              dest.capabilities &&
              dest.capabilities.printer &&
              dest.capabilities.printer.copies) ||
             null;
    }
  };

  // Export
  return {
    Copies: Copies
  };
});

// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview.ticket_items', function() {
  'use strict';

  /**
   * DPI ticket item.
   * @param {!print_preview.AppState} appState App state used to persist DPI
   *     selection.
   * @param {!print_preview.DestinationStore} destinationStore Destination store
   *     used to determine if a destination has the DPI capability.
   * @constructor
   * @extends {print_preview.ticket_items.TicketItem}
   */
  function Dpi(appState, destinationStore) {
    print_preview.ticket_items.TicketItem.call(
        this,
        appState,
        print_preview.AppState.Field.DPI,
        destinationStore);
  };

  Dpi.prototype = {
    __proto__: print_preview.ticket_items.TicketItem.prototype,

    /** @override */
    wouldValueBeValid: function(value) {
      if (!this.isCapabilityAvailable())
        return false;
      return this.capability.option.some(function(option) {
        return option.horizontal_dpi == value.horizontal_dpi &&
               option.vertical_dpi == value.vertical_dpi &&
               option.vendor_id == value.vendor_id;
      });
    },

    /** @override */
    isCapabilityAvailable: function() {
      return !!this.capability &&
             !!this.capability.option &&
             this.capability.option.length > 1;
    },

    /** @override */
    isValueEqual: function(value) {
      var myValue = this.getValue();
      return myValue.horizontal_dpi == value.horizontal_dpi &&
             myValue.vertical_dpi == value.vertical_dpi &&
             myValue.vendor_id == value.vendor_id;
    },

    /** @return {Object} DPI capability of the selected destination. */
    get capability() {
      var destination = this.getSelectedDestInternal();
      return (destination &&
              destination.capabilities &&
              destination.capabilities.printer &&
              destination.capabilities.printer.dpi) ||
             null;
    },

    /** @override */
    getDefaultValueInternal: function() {
      var defaultOptions = this.capability.option.filter(function(option) {
        return option.is_default;
      });
      return defaultOptions.length > 0 ? defaultOptions[0] : null;
    },

    /** @override */
    getCapabilityNotAvailableValueInternal: function() {
      return {};
    }
  };

  // Export
  return {
    Dpi: Dpi
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview.ticket_items', function() {
  'use strict';

  /**
   * Duplex ticket item whose value is a {@code boolean} that indicates whether
   * the document should be duplex printed.
   * @param {!print_preview.AppState} appState App state used to persist collate
   *     selection.
   * @param {!print_preview.DestinationStore} destinationStore Destination store
   *     used determine if a destination has the collate capability.
   * @constructor
   * @extends {print_preview.ticket_items.TicketItem}
   */
  function Duplex(appState, destinationStore) {
    print_preview.ticket_items.TicketItem.call(
        this,
        appState,
        print_preview.AppState.Field.IS_DUPLEX_ENABLED,
        destinationStore);
  };

  Duplex.prototype = {
    __proto__: print_preview.ticket_items.TicketItem.prototype,

    /** @override */
    wouldValueBeValid: function(value) {
      return true;
    },

    /** @override */
    isCapabilityAvailable: function() {
      var cap = this.getDuplexCapability_();
      if (!cap) {
        return false;
      }
      var hasLongEdgeOption = false;
      var hasSimplexOption = false;
      cap.option.forEach(function(option) {
        hasLongEdgeOption = hasLongEdgeOption || option.type == 'LONG_EDGE';
        hasSimplexOption = hasSimplexOption || option.type == 'NO_DUPLEX';
      });
      return hasLongEdgeOption && hasSimplexOption;
    },

    /** @override */
    getDefaultValueInternal: function() {
      var cap = this.getDuplexCapability_();
      var defaultOptions = cap.option.filter(function(option) {
        return option.is_default;
      });
      return defaultOptions.length == 0 ? false :
                                          defaultOptions[0].type == 'LONG_EDGE';
    },

    /** @override */
    getCapabilityNotAvailableValueInternal: function() {
      return false;
    },

    /**
     * @return {Object} Duplex capability of the selected destination.
     * @private
     */
    getDuplexCapability_: function() {
      var dest = this.getSelectedDestInternal();
      return (dest &&
              dest.capabilities &&
              dest.capabilities.printer &&
              dest.capabilities.printer.duplex) ||
             null;
    }
  };

  // Export
  return {
    Duplex: Duplex
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview.ticket_items', function() {
  'use strict';

  /**
   * Header-footer ticket item whose value is a {@code boolean} that indicates
   * whether the document should be printed with headers and footers.
   * @param {!print_preview.AppState} appState App state used to persist whether
   *     header-footer is enabled.
   * @param {!print_preview.DocumentInfo} documentInfo Information about the
   *     document to print.
   * @param {!print_preview.ticket_items.MarginsType} marginsType Ticket item
   *     that stores which predefined margins to print with.
   * @param {!print_preview.ticket_items.CustomMargins} customMargins Ticket
   *     item that stores custom margin values.
   * @constructor
   * @extends {print_preview.ticket_items.TicketItem}
   */
  function HeaderFooter(appState, documentInfo, marginsType, customMargins) {
    print_preview.ticket_items.TicketItem.call(
        this,
        appState,
        print_preview.AppState.Field.IS_HEADER_FOOTER_ENABLED,
        null /*destinationStore*/,
        documentInfo);

    /**
     * Ticket item that stores which predefined margins to print with.
     * @type {!print_preview.ticket_items.MarginsType}
     * @private
     */
    this.marginsType_ = marginsType;

    /**
     * Ticket item that stores custom margin values.
     * @type {!print_preview.ticket_items.CustomMargins}
     * @private
     */
    this.customMargins_ = customMargins;

    this.addEventListeners_();
  };

  HeaderFooter.prototype = {
    __proto__: print_preview.ticket_items.TicketItem.prototype,

    /** @override */
    wouldValueBeValid: function(value) {
      return true;
    },

    /** @override */
    isCapabilityAvailable: function() {
      if (!this.getDocumentInfoInternal().isModifiable) {
        return false;
      } else if (this.marginsType_.getValue() ==
          print_preview.ticket_items.MarginsType.Value.NO_MARGINS) {
        return false;
      } else if (this.marginsType_.getValue() ==
          print_preview.ticket_items.MarginsType.Value.MINIMUM) {
        return true;
      }
      var margins;
      if (this.marginsType_.getValue() ==
          print_preview.ticket_items.MarginsType.Value.CUSTOM) {
        if (!this.customMargins_.isValid()) {
          return false;
        }
        margins = this.customMargins_.getValue();
      } else {
        margins = this.getDocumentInfoInternal().margins;
      }
      var orientEnum = print_preview.ticket_items.CustomMargins.Orientation;
      return margins == null ||
             margins.get(orientEnum.TOP) > 0 ||
             margins.get(orientEnum.BOTTOM) > 0;
    },

    /** @override */
    getDefaultValueInternal: function() {
      return true;
    },

    /** @override */
    getCapabilityNotAvailableValueInternal: function() {
      return false;
    },

    /**
     * Adds CHANGE listeners to dependent ticket items.
     * @private
     */
    addEventListeners_: function() {
      this.getTrackerInternal().add(
          this.marginsType_,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.dispatchChangeEventInternal.bind(this));
      this.getTrackerInternal().add(
          this.customMargins_,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.dispatchChangeEventInternal.bind(this));
    }
  };

  // Export
  return {
    HeaderFooter: HeaderFooter
  };
});

// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview.ticket_items', function() {
  'use strict';

  /**
   * Media size ticket item.
   * @param {!print_preview.AppState} appState App state used to persist media
   *     size selection.
   * @param {!print_preview.DestinationStore} destinationStore Destination store
   *     used to determine if a destination has the media size capability.
   * @param {!print_preview.DocumentInfo} documentInfo Information about the
   *     document to print.
   * @param {!print_preview.ticket_items.MarginsType} marginsType Reset when
   *     landscape value changes.
   * @param {!print_preview.ticket_items.CustomMargins} customMargins Reset when
   *     landscape value changes.
   * @constructor
   * @extends {print_preview.ticket_items.TicketItem}
   */
  function MediaSize(
      appState, destinationStore, documentInfo, marginsType, customMargins) {
    print_preview.ticket_items.TicketItem.call(
        this,
        appState,
        print_preview.AppState.Field.MEDIA_SIZE,
        destinationStore,
        documentInfo);

    /**
     * Margins ticket item. Reset when this item changes.
     * @private {!print_preview.ticket_items.MarginsType}
     */
    this.marginsType_ = marginsType;

    /**
     * Custom margins ticket item. Reset when this item changes.
     * @private {!print_preview.ticket_items.CustomMargins}
     */
    this.customMargins_ = customMargins;
  };

  MediaSize.prototype = {
    __proto__: print_preview.ticket_items.TicketItem.prototype,

    /** @override */
    wouldValueBeValid: function(value) {
      if (!this.isCapabilityAvailable()) {
        return false;
      }
      return this.capability.option.some(function(option) {
        return option.width_microns == value.width_microns &&
               option.height_microns == value.height_microns &&
               option.is_continuous_feed == value.is_continuous_feed &&
               option.vendor_id == value.vendor_id;
      });
    },

    /** @override */
    isCapabilityAvailable: function() {
      var knownSizeToSaveAsPdf =
          (!this.getDocumentInfoInternal().isModifiable ||
           this.getDocumentInfoInternal().hasCssMediaStyles) &&
          this.getSelectedDestInternal() &&
          this.getSelectedDestInternal().id ==
              print_preview.Destination.GooglePromotedId.SAVE_AS_PDF;
      return !knownSizeToSaveAsPdf && !!this.capability;
    },

    /** @override */
    isValueEqual: function(value) {
      var myValue = this.getValue();
      return myValue.width_microns == value.width_microns &&
             myValue.height_microns == value.height_microns &&
             myValue.is_continuous_feed == value.is_continuous_feed &&
             myValue.vendor_id == value.vendor_id;
    },

    /** @return {Object} Media size capability of the selected destination. */
    get capability() {
      var destination = this.getSelectedDestInternal();
      return (destination &&
              destination.capabilities &&
              destination.capabilities.printer &&
              destination.capabilities.printer.media_size) ||
             null;
    },

    /** @override */
    getDefaultValueInternal: function() {
      var defaultOptions = this.capability.option.filter(function(option) {
        return option.is_default;
      });
      return defaultOptions.length > 0 ? defaultOptions[0] : null;
    },

    /** @override */
    getCapabilityNotAvailableValueInternal: function() {
      return {};
    },

    /** @override */
    updateValueInternal: function(value) {
      var updateMargins = !this.isValueEqual(value);
      print_preview.ticket_items.TicketItem.prototype.updateValueInternal.call(
          this, value);
      if (updateMargins) {
        // Reset the user set margins when media size changes.
        this.marginsType_.updateValue(
            print_preview.ticket_items.MarginsType.Value.DEFAULT);
        this.customMargins_.updateValue(null);
      }
    }
  };

  // Export
  return {
    MediaSize: MediaSize
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview.ticket_items', function() {
  'use strict';

  /**
   * Landscape ticket item whose value is a {@code boolean} that indicates
   * whether the document should be printed in landscape orientation.
   * @param {!print_preview.AppState} appState App state object used to persist
   *     ticket item values.
   * @param {!print_preview.DestinationStore} destinationStore Destination store
   *     used to determine the default landscape value and if landscape
   *     printing is available.
   * @param {!print_preview.DocumentInfo} documentInfo Information about the
   *     document to print.
   * @param {!print_preview.ticket_items.MarginsType} marginsType Reset when
   *     landscape value changes.
   * @param {!print_preview.ticket_items.CustomMargins} customMargins Reset when
   *     landscape value changes.
   * @constructor
   * @extends {print_preview.ticket_items.TicketItem}
   */
  function Landscape(appState, destinationStore, documentInfo, marginsType,
                     customMargins) {
    print_preview.ticket_items.TicketItem.call(
        this,
        appState,
        print_preview.AppState.Field.IS_LANDSCAPE_ENABLED,
        destinationStore,
        documentInfo);

    /**
     * Margins ticket item. Reset when landscape ticket item changes.
     * @type {!print_preview.ticket_items.MarginsType}
     * @private
     */
    this.marginsType_ = marginsType;

    /**
     * Custom margins ticket item. Reset when landscape ticket item changes.
     * @type {!print_preview.ticket_items.CustomMargins}
     * @private
     */
    this.customMargins_ = customMargins;
  };

  Landscape.prototype = {
    __proto__: print_preview.ticket_items.TicketItem.prototype,

    /** @override */
    wouldValueBeValid: function(value) {
      return true;
    },

    /** @override */
    isCapabilityAvailable: function() {
      var cap = this.getPageOrientationCapability_();
      if (!cap)
        return false;
      var hasAutoOrPortraitOption = false;
      var hasLandscapeOption = false;
      cap.option.forEach(function(option) {
        hasAutoOrPortraitOption = hasAutoOrPortraitOption ||
            option.type == 'AUTO' ||
            option.type == 'PORTRAIT';
        hasLandscapeOption = hasLandscapeOption || option.type == 'LANDSCAPE';
      });
      // TODO(rltoscano): Technically, the print destination can still change
      // the orientation of the print out (at least for cloud printers) if the
      // document is not modifiable. But the preview wouldn't update in this
      // case so it would be a bad user experience.
      return this.getDocumentInfoInternal().isModifiable &&
          !this.getDocumentInfoInternal().hasCssMediaStyles &&
          hasAutoOrPortraitOption &&
          hasLandscapeOption;
    },

    /** @override */
    getDefaultValueInternal: function() {
      var cap = this.getPageOrientationCapability_();
      var defaultOptions = cap.option.filter(function(option) {
        return option.is_default;
      });
      return defaultOptions.length == 0 ? false :
                                          defaultOptions[0].type == 'LANDSCAPE';
    },

    /** @override */
    getCapabilityNotAvailableValueInternal: function() {
      var doc = this.getDocumentInfoInternal();
      return doc.hasCssMediaStyles ?
          (doc.pageSize.width > doc.pageSize.height) :
          false;
    },

    /** @override */
    updateValueInternal: function(value) {
      var updateMargins = !this.isValueEqual(value);
      print_preview.ticket_items.TicketItem.prototype.updateValueInternal.call(
          this, value);
      if (updateMargins) {
        // Reset the user set margins when page orientation changes.
        this.marginsType_.updateValue(
          print_preview.ticket_items.MarginsType.Value.DEFAULT);
        this.customMargins_.updateValue(null);
      }
    },

    /**
     * @return {boolean} Whether capability contains the |value|.
     * @param {string} value Option to check.
     */
    hasOption: function(value) {
      var cap = this.getPageOrientationCapability_();
      if (!cap)
        return false;
      return cap.option.some(function(option) {
        return option.type == value;
      });
    },

    /**
     * @return {Object} Page orientation capability of the selected destination.
     * @private
     */
    getPageOrientationCapability_: function() {
      var dest = this.getSelectedDestInternal();
      return (dest &&
              dest.capabilities &&
              dest.capabilities.printer &&
              dest.capabilities.printer.page_orientation) ||
             null;
    }
  };

  // Export
  return {
    Landscape: Landscape
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview.ticket_items', function() {
  'use strict';

  /**
   * Margins type ticket item whose value is a
   * {@link print_preview.ticket_items.MarginsType.Value} that indicates what
   * predefined margins type to use.
   * @param {!print_preview.AppState} appState App state persistence object to
   *     save the state of the margins type selection.
   * @param {!print_preview.DocumentInfo} documentInfo Information about the
   *     document to print.
   * @param {!print_preview.ticket_items.CustomMargins} customMargins Custom
   *     margins ticket item, used to write when margins type changes.
   * @constructor
   * @extends {print_preview.ticket_items.TicketItem}
   */
  function MarginsType(appState, documentInfo, customMargins) {
    print_preview.ticket_items.TicketItem.call(
        this,
        appState,
        print_preview.AppState.Field.MARGINS_TYPE,
        null /*destinationStore*/,
        documentInfo);

    /**
     * Custom margins ticket item, used to write when margins type changes.
     * @type {!print_preview.ticket_items.CustomMargins}
     * @private
     */
    this.customMargins_ = customMargins;
  };

  /**
   * Enumeration of margin types. Matches enum MarginType in
   * printing/print_job_constants.h.
   * @enum {number}
   */
  MarginsType.Value = {
    DEFAULT: 0,
    NO_MARGINS: 1,
    MINIMUM: 2,
    CUSTOM: 3
  };

  MarginsType.prototype = {
    __proto__: print_preview.ticket_items.TicketItem.prototype,

    /** @override */
    wouldValueBeValid: function(value) {
      return true;
    },

    /** @override */
    isCapabilityAvailable: function() {
      return this.getDocumentInfoInternal().isModifiable;
    },

    /** @override */
    getDefaultValueInternal: function() {
      return MarginsType.Value.DEFAULT;
    },

    /** @override */
    getCapabilityNotAvailableValueInternal: function() {
      return MarginsType.Value.DEFAULT;
    },

    /** @override */
    updateValueInternal: function(value) {
      print_preview.ticket_items.TicketItem.prototype.updateValueInternal.call(
          this, value);
      if (this.isValueEqual(
          print_preview.ticket_items.MarginsType.Value.CUSTOM)) {
        // If CUSTOM, set the value of the custom margins so that it won't be
        // overridden by the default value.
        this.customMargins_.updateValue(this.customMargins_.getValue());
      }
    }
  };

  // Export
  return {
    MarginsType: MarginsType
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview.ticket_items', function() {
  'use strict';

  /**
   * Page range ticket item whose value is a {@code string} that represents
   * which pages in the document should be printed.
   * @param {!print_preview.DocumentInfo} documentInfo Information about the
   *     document to print.
   * @constructor
   * @extends {print_preview.ticket_items.TicketItem}
   */
  function PageRange(documentInfo) {
    print_preview.ticket_items.TicketItem.call(
        this,
        null /*appState*/,
        null /*field*/,
        null /*destinationStore*/,
        documentInfo);
  };

  /**
   * Impossibly large page number.
   * @type {number}
   * @const
   * @private
   */
  PageRange.MAX_PAGE_NUMBER_ = 1000000000;

  PageRange.prototype = {
    __proto__: print_preview.ticket_items.TicketItem.prototype,

    /** @override */
    wouldValueBeValid: function(value) {
      var result = pageRangeTextToPageRanges(
          value, this.getDocumentInfoInternal().pageCount);
      return result instanceof Array;
    },

    /**
     * @return {!print_preview.PageNumberSet} Set of page numbers defined by the
     *     page range string.
     */
    getPageNumberSet: function() {
      var pageNumberList = pageRangeTextToPageList(
          this.getValue(), this.getDocumentInfoInternal().pageCount);
      return new print_preview.PageNumberSet(pageNumberList);
    },

    /** @override */
    isCapabilityAvailable: function() {
      return true;
    },

    /** @override */
    getDefaultValueInternal: function() {
      return '';
    },

    /** @override */
    getCapabilityNotAvailableValueInternal: function() {
      return '';
    },

    /**
     * @return {!Array<Object<{from: number, to: number}>>} A list of page
     *     ranges.
     */
    getPageRanges: function() {
      var pageRanges = pageRangeTextToPageRanges(this.getValue());
      return pageRanges instanceof Array ? pageRanges : [];
    },

    /**
     * @return {!Array<object<{from: number, to: number}>>} A list of page
     *     ranges suitable for use in the native layer.
     * TODO(vitalybuka): this should be removed when native layer switched to
     *     page ranges.
     */
    getDocumentPageRanges: function() {
      var pageRanges = pageRangeTextToPageRanges(
          this.getValue(), this.getDocumentInfoInternal().pageCount);
      return pageRanges instanceof Array ? pageRanges : [];
    },

    /**
     * @return {!number} Number of pages reported by the document.
     */
    getDocumentNumPages: function() {
      return this.getDocumentInfoInternal().pageCount;
    },

    /**
     * @return {!PageRangeStatus}
     */
    checkValidity: function() {
      var pageRanges = pageRangeTextToPageRanges(
          this.getValue(), this.getDocumentInfoInternal().pageCount);
      return pageRanges instanceof Array ?
          PageRangeStatus.NO_ERROR : pageRanges;
    },
  };

  // Export
  return {
    PageRange: PageRange
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview.ticket_items', function() {
  'use strict';

  /**
   * Fit-to-page ticket item whose value is a {@code boolean} that indicates
   * whether to scale the document to fit the page.
   * @param {!print_preview.AppState} appState App state to persist item value.
   * @param {!print_preview.DocumentInfo} documentInfo Information about the
   *     document to print.
   * @param {!print_preview.DestinationStore} destinationStore Used to determine
   *     whether fit to page should be available.
   * @constructor
   * @extends {print_preview.ticket_items.TicketItem}
   */
  function FitToPage(appState, documentInfo, destinationStore) {
    print_preview.ticket_items.TicketItem.call(
        this,
        appState,
        print_preview.AppState.Field.IS_FIT_TO_PAGE_ENABLED,
        destinationStore,
        documentInfo);
  };

  FitToPage.prototype = {
    __proto__: print_preview.ticket_items.TicketItem.prototype,

    /** @override */
    wouldValueBeValid: function(value) {
      return true;
    },

    /** @override */
    isCapabilityAvailable: function() {
      return !this.getDocumentInfoInternal().isModifiable &&
          (!this.getSelectedDestInternal() ||
              this.getSelectedDestInternal().id !=
                  print_preview.Destination.GooglePromotedId.SAVE_AS_PDF);
    },

    /** @override */
    getDefaultValueInternal: function() {
      // It's on by default since it is not a document feature, it is rather
      // a property of the printer, hardware margins limitations. User can
      // always override it.
      return true;
    },

    /** @override */
    getCapabilityNotAvailableValueInternal: function() {
      return !this.getSelectedDestInternal() ||
          this.getSelectedDestInternal().id !=
              print_preview.Destination.GooglePromotedId.SAVE_AS_PDF;
    }
  };

  // Export
  return {
    FitToPage: FitToPage
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview.ticket_items', function() {
  'use strict';

  /**
   * Ticket item whose value is a {@code boolean} that represents whether to
   * print CSS backgrounds.
   * @param {!print_preview.AppState} appState App state to persist CSS
   *     background value.
   * @param {!print_preview.DocumentInfo} documentInfo Information about the
   *     document to print.
   * @constructor
   * @extends {print_preview.ticket_items.TicketItem}
   */
  function CssBackground(appState, documentInfo) {
    print_preview.ticket_items.TicketItem.call(
        this,
        appState,
        print_preview.AppState.Field.IS_CSS_BACKGROUND_ENABLED,
        null /*destinationStore*/,
        documentInfo);
  };

  CssBackground.prototype = {
    __proto__: print_preview.ticket_items.TicketItem.prototype,

    /** @override */
    wouldValueBeValid: function(value) {
      return true;
    },

    /** @override */
    isCapabilityAvailable: function() {
      return this.getDocumentInfoInternal().isModifiable;
    },

    /** @override */
    getDefaultValueInternal: function() {
      return false;
    },

    /** @override */
    getCapabilityNotAvailableValueInternal: function() {
      return false;
    }
  };

  // Export
  return {
    CssBackground: CssBackground
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview.ticket_items', function() {
  'use strict';

  /**
   * Ticket item whose value is a {@code boolean} that represents whether to
   * print selection only.
   * @param {!print_preview.DocumentInfo} documentInfo Information about the
   *     document to print.
   * @constructor
   * @extends {print_preview.ticket_items.TicketItem}
   */
  function SelectionOnly(documentInfo) {
    print_preview.ticket_items.TicketItem.call(
        this,
        null /*appState*/,
        null /*field*/,
        null /*destinationStore*/,
        documentInfo);
  };

  SelectionOnly.prototype = {
    __proto__: print_preview.ticket_items.TicketItem.prototype,

    /** @override */
    wouldValueBeValid: function(value) {
      return true;
    },

    /** @override */
    isCapabilityAvailable: function() {
      return this.getDocumentInfoInternal().isModifiable &&
             this.getDocumentInfoInternal().hasSelection;
    },

    /** @override */
    getDefaultValueInternal: function() {
      return false;
    },

    /** @override */
    getCapabilityNotAvailableValueInternal: function() {
      return false;
    }
  };

  // Export
  return {
    SelectionOnly: SelectionOnly
  };
});

// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview.ticket_items', function() {
  'use strict';

  /**
   * An object that represents a user modifiable item in a print ticket. Each
   * ticket item has a value which can be set by the user. Ticket items can also
   * be unavailable for modifying if the print destination doesn't support it or
   * if other ticket item constraints are not met.
   * @param {print_preview.AppState} appState Application state model to update
   *     when ticket items update.
   * @param {print_preview.DestinationStore} destinationStore Used listen for
   *     changes in the currently selected destination's capabilities. Since
   *     this is a common dependency of ticket items, it's handled in the base
   *     class.
   * @constructor
   * @extends {cr.EventTarget}
   */
  function VendorItems(appState, destinationStore) {
    cr.EventTarget.call(this);

    /**
     * Application state model to update when ticket items update.
     * @private {print_preview.AppState}
     */
    this.appState_ = appState || null;

    /**
     * Used listen for changes in the currently selected destination's
     * capabilities.
     * @private {print_preview.DestinationStore}
     */
    this.destinationStore_ = destinationStore || null;

    /**
     * Vendor ticket items store, maps item id to the item value.
     * @private {!Object<string>}
     */
    this.items_ = {};
  };

  VendorItems.prototype = {
    __proto__: cr.EventTarget.prototype,

    /** @return {boolean} Whether vendor capabilities are available. */
    isCapabilityAvailable: function() {
      return !!this.capability;
    },

    /** @return {boolean} Whether the ticket item was modified by the user. */
    isUserEdited: function() {
      // If there's at least one ticket item stored in values, it was edited.
      for (var key in this.items_) {
        if (this.items_.hasOwnProperty(key))
          return true;
      }
      return false;
    },

    /** @return {Object} Vendor capabilities of the selected destination. */
    get capability() {
      var destination = this.destinationStore_ ?
          this.destinationStore_.selectedDestination : null;
      if (!destination)
        return null;
      if (destination.id == print_preview.Destination.GooglePromotedId.FEDEX ||
          destination.type == print_preview.Destination.Type.MOBILE) {
        return null;
      }
      return (destination.capabilities &&
              destination.capabilities.printer &&
              destination.capabilities.printer.vendor_capability) ||
             null;
    },

    /**
     * Vendor ticket items store, maps item id to the item value.
     * @return {!Object<string>}
     */
    get ticketItems() {
      return this.items_;
    },

    /**
     * @param {!Object<string>} values Values to set as the values of vendor
     *     ticket items. Maps vendor item id to the value.
     */
    updateValue: function(values) {
      this.items_ = {};
      if (typeof values == 'object') {
        for (var key in values) {
          if (values.hasOwnProperty(key) && typeof values[key] == 'string') {
            // Let's empirically limit each value at 2K.
            this.items_[key] = values[key].substring(0, 2048);
          }
        }
      }

      if (this.appState_) {
        this.appState_.persistField(
            print_preview.AppState.Field.VENDOR_OPTIONS, this.items_);
      }
    }
  };

  // Export
  return {
    VendorItems: VendorItems
  };
});


// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.exportPath('print_preview');

/**
 * @typedef {{selectSaveAsPdfDestination: boolean,
 *            layoutSettings.portrait: boolean,
 *            pageRange: string,
 *            headersAndFooters: boolean,
 *            backgroundColorsAndImages: boolean,
 *            margins: number}}
 * @see chrome/browser/printing/print_preview_pdf_generated_browsertest.cc
 */
print_preview.PreviewSettings;

cr.define('print_preview', function() {
  'use strict';

  /**
   * An interface to the native Chromium printing system layer.
   * @constructor
   * @extends {cr.EventTarget}
   */
  function NativeLayer() {
    cr.EventTarget.call(this);

    // Bind global handlers
    global.setInitialSettings = this.onSetInitialSettings_.bind(this);
    global.setUseCloudPrint = this.onSetUseCloudPrint_.bind(this);
    global.setPrinters = this.onSetPrinters_.bind(this);
    global.updateWithPrinterCapabilities =
        this.onUpdateWithPrinterCapabilities_.bind(this);
    global.failedToGetPrinterCapabilities =
        this.onFailedToGetPrinterCapabilities_.bind(this);
    global.failedToGetPrivetPrinterCapabilities =
      this.onFailedToGetPrivetPrinterCapabilities_.bind(this);
    global.failedToGetExtensionPrinterCapabilities =
        this.onFailedToGetExtensionPrinterCapabilities_.bind(this);
    global.reloadPrintersList = this.onReloadPrintersList_.bind(this);
    global.printToCloud = this.onPrintToCloud_.bind(this);
    global.fileSelectionCancelled =
        this.onFileSelectionCancelled_.bind(this);
    global.fileSelectionCompleted =
        this.onFileSelectionCompleted_.bind(this);
    global.printPreviewFailed = this.onPrintPreviewFailed_.bind(this);
    global.invalidPrinterSettings =
        this.onInvalidPrinterSettings_.bind(this);
    global.onDidGetDefaultPageLayout =
        this.onDidGetDefaultPageLayout_.bind(this);
    global.onDidGetPreviewPageCount =
        this.onDidGetPreviewPageCount_.bind(this);
    global.onDidPreviewPage = this.onDidPreviewPage_.bind(this);
    global.updatePrintPreview = this.onUpdatePrintPreview_.bind(this);
    global.onDidGetAccessToken = this.onDidGetAccessToken_.bind(this);
    global.autoCancelForTesting = this.autoCancelForTesting_.bind(this);
    global.onPrivetPrinterChanged = this.onPrivetPrinterChanged_.bind(this);
    global.onPrivetCapabilitiesSet =
        this.onPrivetCapabilitiesSet_.bind(this);
    global.onPrivetPrintFailed = this.onPrivetPrintFailed_.bind(this);
    global.onExtensionPrintersAdded =
        this.onExtensionPrintersAdded_.bind(this);
    global.onExtensionCapabilitiesSet =
        this.onExtensionCapabilitiesSet_.bind(this);
    global.onEnableManipulateSettingsForTest =
        this.onEnableManipulateSettingsForTest_.bind(this);
    global.printPresetOptionsFromDocument =
        this.onPrintPresetOptionsFromDocument_.bind(this);
    global.onProvisionalPrinterResolved =
        this.onProvisionalDestinationResolved_.bind(this);
    global.failedToResolveProvisionalPrinter =
        this.failedToResolveProvisionalDestination_.bind(this);
  };

  /**
   * Event types dispatched from the Chromium native layer.
   * @enum {string}
   * @const
   */
  NativeLayer.EventType = {
    ACCESS_TOKEN_READY: 'print_preview.NativeLayer.ACCESS_TOKEN_READY',
    CAPABILITIES_SET: 'print_preview.NativeLayer.CAPABILITIES_SET',
    CLOUD_PRINT_ENABLE: 'print_preview.NativeLayer.CLOUD_PRINT_ENABLE',
    DESTINATIONS_RELOAD: 'print_preview.NativeLayer.DESTINATIONS_RELOAD',
    DISABLE_SCALING: 'print_preview.NativeLayer.DISABLE_SCALING',
    FILE_SELECTION_CANCEL: 'print_preview.NativeLayer.FILE_SELECTION_CANCEL',
    FILE_SELECTION_COMPLETE:
        'print_preview.NativeLayer.FILE_SELECTION_COMPLETE',
    GET_CAPABILITIES_FAIL: 'print_preview.NativeLayer.GET_CAPABILITIES_FAIL',
    INITIAL_SETTINGS_SET: 'print_preview.NativeLayer.INITIAL_SETTINGS_SET',
    LOCAL_DESTINATIONS_SET: 'print_preview.NativeLayer.LOCAL_DESTINATIONS_SET',
    MANIPULATE_SETTINGS_FOR_TEST:
        'print_preview.NativeLayer.MANIPULATE_SETTINGS_FOR_TEST',
    PAGE_COUNT_READY: 'print_preview.NativeLayer.PAGE_COUNT_READY',
    PAGE_LAYOUT_READY: 'print_preview.NativeLayer.PAGE_LAYOUT_READY',
    PAGE_PREVIEW_READY: 'print_preview.NativeLayer.PAGE_PREVIEW_READY',
    PREVIEW_GENERATION_DONE:
        'print_preview.NativeLayer.PREVIEW_GENERATION_DONE',
    PREVIEW_GENERATION_FAIL:
        'print_preview.NativeLayer.PREVIEW_GENERATION_FAIL',
    PRINT_TO_CLOUD: 'print_preview.NativeLayer.PRINT_TO_CLOUD',
    SETTINGS_INVALID: 'print_preview.NativeLayer.SETTINGS_INVALID',
    PRIVET_PRINTER_CHANGED: 'print_preview.NativeLayer.PRIVET_PRINTER_CHANGED',
    PRIVET_CAPABILITIES_SET:
        'print_preview.NativeLayer.PRIVET_CAPABILITIES_SET',
    PRIVET_PRINT_FAILED: 'print_preview.NativeLayer.PRIVET_PRINT_FAILED',
    EXTENSION_PRINTERS_ADDED:
        'print_preview.NativeLayer.EXTENSION_PRINTERS_ADDED',
    EXTENSION_CAPABILITIES_SET:
        'print_preview.NativeLayer.EXTENSION_CAPABILITIES_SET',
    PRINT_PRESET_OPTIONS: 'print_preview.NativeLayer.PRINT_PRESET_OPTIONS',
    PROVISIONAL_DESTINATION_RESOLVED:
        'print_preview.NativeLayer.PROVISIONAL_DESTINATION_RESOLVED'
  };

  /**
   * Constant values matching printing::DuplexMode enum.
   * @enum {number}
   */
  NativeLayer.DuplexMode = {
    SIMPLEX: 0,
    LONG_EDGE: 1,
    UNKNOWN_DUPLEX_MODE: -1
  };

  /**
   * Enumeration of color modes used by Chromium.
   * @enum {number}
   * @private
   */
  NativeLayer.ColorMode_ = {
    GRAY: 1,
    COLOR: 2
  };

  /**
   * Version of the serialized state of the print preview.
   * @type {number}
   * @const
   * @private
   */
  NativeLayer.SERIALIZED_STATE_VERSION_ = 1;

  NativeLayer.prototype = {
    __proto__: cr.EventTarget.prototype,

    /**
     * Requests access token for cloud print requests.
     * @param {string} authType type of access token.
     */
    startGetAccessToken: function(authType) {
      chrome.send('getAccessToken', [authType]);
    },

    /** Gets the initial settings to initialize the print preview with. */
    startGetInitialSettings: function() {
      chrome.send('getInitialSettings');
    },

    /**
     * Requests the system's local print destinations. A LOCAL_DESTINATIONS_SET
     * event will be dispatched in response.
     */
    startGetLocalDestinations: function() {
      chrome.send('getPrinters');
    },

    /**
     * Requests the network's privet print destinations. A number of
     * PRIVET_PRINTER_CHANGED events will be fired in response, followed by a
     * PRIVET_SEARCH_ENDED.
     */
    startGetPrivetDestinations: function() {
      chrome.send('getPrivetPrinters');
    },

    /**
     * Requests that the privet print stack stop searching for privet print
     * destinations.
     */
    stopGetPrivetDestinations: function() {
      chrome.send('stopGetPrivetPrinters');
    },

    /**
     * Requests the privet destination's printing capabilities. A
     * PRIVET_CAPABILITIES_SET event will be dispatched in response.
     * @param {string} destinationId ID of the destination.
     */
    startGetPrivetDestinationCapabilities: function(destinationId) {
      chrome.send('getPrivetPrinterCapabilities', [destinationId]);
    },

    /**
     * Requests that extension system dispatches an event requesting the list of
     * extension managed printers.
     */
    startGetExtensionDestinations: function() {
      chrome.send('getExtensionPrinters');
    },

    /**
     * Requests an extension destination's printing capabilities. A
     * EXTENSION_CAPABILITIES_SET event will be dispatched in response.
     * @param {string} destinationId The ID of the destination whose
     *     capabilities are requested.
     */
    startGetExtensionDestinationCapabilities: function(destinationId) {
      chrome.send('getExtensionPrinterCapabilities', [destinationId]);
    },

    /**
     * Requests the destination's printing capabilities. A CAPABILITIES_SET
     * event will be dispatched in response.
     * @param {string} destinationId ID of the destination.
     */
    startGetLocalDestinationCapabilities: function(destinationId) {
      chrome.send('getPrinterCapabilities', [destinationId]);
    },

    /**
     * Requests Chrome to resolve provisional extension destination by granting
     * the provider extension access to the printer. Chrome will respond with
     * the resolved destination properties by calling
     * {@code onProvisionalPrinterResolved}, or in case of an error
     * {@code failedToResolveProvisionalPrinter}
     * @param {string} provisionalDestinationId
     */
    grantExtensionPrinterAccess: function(provisionalDestinationId) {
      chrome.send('grantExtensionPrinterAccess', [provisionalDestinationId]);
    },

    /**
     * @param {!print_preview.Destination} destination Destination to print to.
     * @param {!print_preview.ticket_items.Color} color Color ticket item.
     * @return {number} Native layer color model.
     * @private
     */
    getNativeColorModel_: function(destination, color) {
      // For non-local printers native color model is ignored anyway.
      var option = destination.isLocal ? color.getSelectedOption() : null;
      var nativeColorModel = parseInt(option ? option.vendor_id : null, 10);
      if (isNaN(nativeColorModel)) {
        return color.getValue() ?
            NativeLayer.ColorMode_.COLOR : NativeLayer.ColorMode_.GRAY;
      }
      return nativeColorModel;
    },

    /**
     * Requests that a preview be generated. The following events may be
     * dispatched in response:
     *   - PAGE_COUNT_READY
     *   - PAGE_LAYOUT_READY
     *   - PAGE_PREVIEW_READY
     *   - PREVIEW_GENERATION_DONE
     *   - PREVIEW_GENERATION_FAIL
     * @param {print_preview.Destination} destination Destination to print to.
     * @param {!print_preview.PrintTicketStore} printTicketStore Used to get the
     *     state of the print ticket.
     * @param {!print_preview.DocumentInfo} documentInfo Document data model.
     * @param {number} requestId ID of the preview request.
     */
    startGetPreview: function(
        destination, printTicketStore, documentInfo, requestId) {
      assert(printTicketStore.isTicketValidForPreview(),
             'Trying to generate preview when ticket is not valid');

      var ticket = {
        'pageRange': printTicketStore.pageRange.getDocumentPageRanges(),
        'mediaSize': printTicketStore.mediaSize.getValue(),
        'landscape': printTicketStore.landscape.getValue(),
        'color': this.getNativeColorModel_(destination, printTicketStore.color),
        'headerFooterEnabled': printTicketStore.headerFooter.getValue(),
        'marginsType': printTicketStore.marginsType.getValue(),
        'isFirstRequest': requestId == 0,
        'requestID': requestId,
        'previewModifiable': documentInfo.isModifiable,
        'printToPDF':
            destination != null &&
            destination.id ==
                print_preview.Destination.GooglePromotedId.SAVE_AS_PDF,
        'printWithCloudPrint': destination != null && !destination.isLocal,
        'printWithPrivet': destination != null && destination.isPrivet,
        'printWithExtension': destination != null && destination.isExtension,
        'deviceName': destination == null ? 'foo' : destination.id,
        'generateDraftData': documentInfo.isModifiable,
        'fitToPageEnabled': printTicketStore.fitToPage.getValue(),

        // NOTE: Even though the following fields don't directly relate to the
        // preview, they still need to be included.
        'duplex': printTicketStore.duplex.getValue() ?
            NativeLayer.DuplexMode.LONG_EDGE : NativeLayer.DuplexMode.SIMPLEX,
        'copies': 1,
        'collate': true,
        'shouldPrintBackgrounds': printTicketStore.cssBackground.getValue(),
        'shouldPrintSelectionOnly': printTicketStore.selectionOnly.getValue()
      };

      // Set 'cloudPrintID' only if the destination is not local.
      if (destination && !destination.isLocal) {
        ticket['cloudPrintID'] = destination.id;
      }

      if (printTicketStore.marginsType.isCapabilityAvailable() &&
          printTicketStore.marginsType.getValue() ==
              print_preview.ticket_items.MarginsType.Value.CUSTOM) {
        var customMargins = printTicketStore.customMargins.getValue();
        var orientationEnum =
            print_preview.ticket_items.CustomMargins.Orientation;
        ticket['marginsCustom'] = {
          'marginTop': customMargins.get(orientationEnum.TOP),
          'marginRight': customMargins.get(orientationEnum.RIGHT),
          'marginBottom': customMargins.get(orientationEnum.BOTTOM),
          'marginLeft': customMargins.get(orientationEnum.LEFT)
        };
      }

      chrome.send(
          'getPreview',
          [JSON.stringify(ticket),
           requestId > 0 ? documentInfo.pageCount : -1,
           documentInfo.isModifiable]);
    },

    /**
     * Requests that the document be printed.
     * @param {!print_preview.Destination} destination Destination to print to.
     * @param {!print_preview.PrintTicketStore} printTicketStore Used to get the
     *     state of the print ticket.
     * @param {cloudprint.CloudPrintInterface} cloudPrintInterface Interface
     *     to Google Cloud Print.
     * @param {!print_preview.DocumentInfo} documentInfo Document data model.
     * @param {boolean=} opt_isOpenPdfInPreview Whether to open the PDF in the
     *     system's preview application.
     * @param {boolean=} opt_showSystemDialog Whether to open system dialog for
     *     advanced settings.
     */
    startPrint: function(destination, printTicketStore, cloudPrintInterface,
                         documentInfo, opt_isOpenPdfInPreview,
                         opt_showSystemDialog) {
      assert(printTicketStore.isTicketValid(),
             'Trying to print when ticket is not valid');

      assert(!opt_showSystemDialog || (cr.isWindows && destination.isLocal),
             'Implemented for Windows only');

      var ticket = {
        'pageRange': printTicketStore.pageRange.getDocumentPageRanges(),
        'mediaSize': printTicketStore.mediaSize.getValue(),
        'pageCount': printTicketStore.pageRange.getPageNumberSet().size,
        'landscape': printTicketStore.landscape.getValue(),
        'color': this.getNativeColorModel_(destination, printTicketStore.color),
        'headerFooterEnabled': printTicketStore.headerFooter.getValue(),
        'marginsType': printTicketStore.marginsType.getValue(),
        'generateDraftData': true, // TODO(rltoscano): What should this be?
        'duplex': printTicketStore.duplex.getValue() ?
            NativeLayer.DuplexMode.LONG_EDGE : NativeLayer.DuplexMode.SIMPLEX,
        'copies': printTicketStore.copies.getValueAsNumber(),
        'collate': printTicketStore.collate.getValue(),
        'shouldPrintBackgrounds': printTicketStore.cssBackground.getValue(),
        'shouldPrintSelectionOnly': printTicketStore.selectionOnly.getValue(),
        'previewModifiable': documentInfo.isModifiable,
        'printToPDF': destination.id ==
            print_preview.Destination.GooglePromotedId.SAVE_AS_PDF,
        'printWithCloudPrint': !destination.isLocal,
        'printWithPrivet': destination.isPrivet,
        'printWithExtension': destination.isExtension,
        'deviceName': destination.id,
        'isFirstRequest': false,
        'requestID': -1,
        'fitToPageEnabled': printTicketStore.fitToPage.getValue(),
        'pageWidth': documentInfo.pageSize.width,
        'pageHeight': documentInfo.pageSize.height,
        'showSystemDialog': opt_showSystemDialog
      };

      if (!destination.isLocal) {
        // We can't set cloudPrintID if the destination is "Print with Cloud
        // Print" because the native system will try to print to Google Cloud
        // Print with this ID instead of opening a Google Cloud Print dialog.
        ticket['cloudPrintID'] = destination.id;
      }

      if (printTicketStore.marginsType.isCapabilityAvailable() &&
          printTicketStore.marginsType.isValueEqual(
              print_preview.ticket_items.MarginsType.Value.CUSTOM)) {
        var customMargins = printTicketStore.customMargins.getValue();
        var orientationEnum =
            print_preview.ticket_items.CustomMargins.Orientation;
        ticket['marginsCustom'] = {
          'marginTop': customMargins.get(orientationEnum.TOP),
          'marginRight': customMargins.get(orientationEnum.RIGHT),
          'marginBottom': customMargins.get(orientationEnum.BOTTOM),
          'marginLeft': customMargins.get(orientationEnum.LEFT)
        };
      }

      if (destination.isPrivet || destination.isExtension) {
        ticket['ticket'] = printTicketStore.createPrintTicket(destination);
        ticket['capabilities'] = JSON.stringify(destination.capabilities);
      }

      if (opt_isOpenPdfInPreview) {
        ticket['OpenPDFInPreview'] = true;
      }

      chrome.send('print', [JSON.stringify(ticket)]);
    },

    /** Requests that the current pending print request be cancelled. */
    startCancelPendingPrint: function() {
      chrome.send('cancelPendingPrintRequest');
    },

    /** Shows the system's native printing dialog. */
    startShowSystemDialog: function() {
      assert(!cr.isWindows);
      chrome.send('showSystemDialog');
    },

    /** Closes the print preview dialog. */
    startCloseDialog: function() {
      chrome.send('closePrintPreviewDialog');
      chrome.send('dialogClose');
    },

    /** Hide the print preview dialog and allow the native layer to close it. */
    startHideDialog: function() {
      chrome.send('hidePreview');
    },

    /**
     * Opens the Google Cloud Print sign-in tab. The DESTINATIONS_RELOAD event
     *     will be dispatched in response.
     * @param {boolean} addAccount Whether to open an 'add a new account' or
     *     default sign in page.
     */
    startCloudPrintSignIn: function(addAccount) {
      chrome.send('signIn', [addAccount]);
    },

    /** Navigates the user to the system printer settings interface. */
    startManageLocalDestinations: function() {
      chrome.send('manageLocalPrinters');
    },

    /**
     * Navigates the user to the Google Cloud Print management page.
     * @param {?string} user Email address of the user to open the management
     *     page for (user must be currently logged in, indeed) or {@code null}
     *     to open this page for the primary user.
     */
    startManageCloudDestinations: function(user) {
      chrome.send('manageCloudPrinters', [user || '']);
    },

    /** Forces browser to open a new tab with the given URL address. */
    startForceOpenNewTab: function(url) {
      chrome.send('forceOpenNewTab', [url]);
    },

    /**
     * @param {!Object} initialSettings Object containing all initial settings.
     */
    onSetInitialSettings_: function(initialSettings) {
      var numberFormatSymbols =
          print_preview.MeasurementSystem.parseNumberFormat(
              initialSettings['numberFormat']);
      var unitType = print_preview.MeasurementSystem.UnitType.IMPERIAL;
      if (initialSettings['measurementSystem'] != null) {
        unitType = initialSettings['measurementSystem'];
      }

      var nativeInitialSettings = new print_preview.NativeInitialSettings(
          initialSettings['printAutomaticallyInKioskMode'] || false,
          initialSettings['appKioskMode'] || false,
          numberFormatSymbols[0] || ',',
          numberFormatSymbols[1] || '.',
          unitType,
          initialSettings['previewModifiable'] || false,
          initialSettings['initiatorTitle'] || '',
          initialSettings['documentHasSelection'] || false,
          initialSettings['shouldPrintSelectionOnly'] || false,
          initialSettings['printerName'] || null,
          initialSettings['appState'] || null,
          initialSettings['defaultDestinationSelectionRules'] || null);

      var initialSettingsSetEvent = new Event(
          NativeLayer.EventType.INITIAL_SETTINGS_SET);
      initialSettingsSetEvent.initialSettings = nativeInitialSettings;
      this.dispatchEvent(initialSettingsSetEvent);
    },

    /**
     * Turn on the integration of Cloud Print.
     * @param {{cloudPrintURL: string, appKioskMode: string}} settings
     *     cloudPrintUrl: The URL to use for cloud print servers.
     * @private
     */
    onSetUseCloudPrint_: function(settings) {
      var cloudPrintEnableEvent = new Event(
          NativeLayer.EventType.CLOUD_PRINT_ENABLE);
      cloudPrintEnableEvent.baseCloudPrintUrl = settings['cloudPrintUrl'] || '';
      cloudPrintEnableEvent.appKioskMode = settings['appKioskMode'] || false;
      this.dispatchEvent(cloudPrintEnableEvent);
    },

    /**
     * Updates the print preview with local printers.
     * Called from PrintPreviewHandler::SetupPrinterList().
     * @param {Array} printers Array of printer info objects.
     * @private
     */
    onSetPrinters_: function(printers) {
      var localDestsSetEvent = new Event(
          NativeLayer.EventType.LOCAL_DESTINATIONS_SET);
      localDestsSetEvent.destinationInfos = printers;
      this.dispatchEvent(localDestsSetEvent);
    },

    /**
     * Called when native layer gets settings information for a requested local
     * destination.
     * @param {Object} settingsInfo printer setting information.
     * @private
     */
    onUpdateWithPrinterCapabilities_: function(settingsInfo) {
      var capsSetEvent = new Event(NativeLayer.EventType.CAPABILITIES_SET);
      capsSetEvent.settingsInfo = settingsInfo;
      this.dispatchEvent(capsSetEvent);
    },

    /**
     * Called when native layer gets settings information for a requested local
     * destination.
     * @param {string} destinationId Printer affected by error.
     * @private
     */
    onFailedToGetPrinterCapabilities_: function(destinationId) {
      var getCapsFailEvent = new Event(
          NativeLayer.EventType.GET_CAPABILITIES_FAIL);
      getCapsFailEvent.destinationId = destinationId;
      getCapsFailEvent.destinationOrigin =
          print_preview.Destination.Origin.LOCAL;
      this.dispatchEvent(getCapsFailEvent);
    },

    /**
     * Called when native layer gets settings information for a requested privet
     * destination.
     * @param {string} destinationId Printer affected by error.
     * @private
     */
    onFailedToGetPrivetPrinterCapabilities_: function(destinationId) {
      var getCapsFailEvent = new Event(
          NativeLayer.EventType.GET_CAPABILITIES_FAIL);
      getCapsFailEvent.destinationId = destinationId;
      getCapsFailEvent.destinationOrigin =
          print_preview.Destination.Origin.PRIVET;
      this.dispatchEvent(getCapsFailEvent);
    },

    /**
     * Called when native layer fails to get settings information for a
     * requested extension destination.
     * @param {string} destinationId Printer affected by error.
     * @private
     */
    onFailedToGetExtensionPrinterCapabilities_: function(destinationId) {
      var getCapsFailEvent = new Event(
          NativeLayer.EventType.GET_CAPABILITIES_FAIL);
      getCapsFailEvent.destinationId = destinationId;
      getCapsFailEvent.destinationOrigin =
          print_preview.Destination.Origin.EXTENSION;
      this.dispatchEvent(getCapsFailEvent);
    },

    /** Reloads the printer list. */
    onReloadPrintersList_: function() {
      cr.dispatchSimpleEvent(this, NativeLayer.EventType.DESTINATIONS_RELOAD);
    },

    /**
     * Called from the C++ layer.
     * Take the PDF data handed to us and submit it to the cloud, closing the
     * print preview dialog once the upload is successful.
     * @param {string} data Data to send as the print job.
     * @private
     */
    onPrintToCloud_: function(data) {
      var printToCloudEvent = new Event(
          NativeLayer.EventType.PRINT_TO_CLOUD);
      printToCloudEvent.data = data;
      this.dispatchEvent(printToCloudEvent);
    },

    /**
     * Called from PrintPreviewUI::OnFileSelectionCancelled to notify the print
     * preview dialog regarding the file selection cancel event.
     * @private
     */
    onFileSelectionCancelled_: function() {
      cr.dispatchSimpleEvent(this, NativeLayer.EventType.FILE_SELECTION_CANCEL);
    },

    /**
     * Called from PrintPreviewUI::OnFileSelectionCompleted to notify the print
     * preview dialog regarding the file selection completed event.
     * @private
     */
    onFileSelectionCompleted_: function() {
      // If the file selection is completed and the dialog is not already closed
      // it means that a pending print to pdf request exists.
      cr.dispatchSimpleEvent(
          this, NativeLayer.EventType.FILE_SELECTION_COMPLETE);
    },

    /**
     * Display an error message when print preview fails.
     * Called from PrintPreviewMessageHandler::OnPrintPreviewFailed().
     * @private
     */
    onPrintPreviewFailed_: function() {
      cr.dispatchSimpleEvent(
          this, NativeLayer.EventType.PREVIEW_GENERATION_FAIL);
    },

    /**
     * Display an error message when encountered invalid printer settings.
     * Called from PrintPreviewMessageHandler::OnInvalidPrinterSettings().
     * @private
     */
    onInvalidPrinterSettings_: function() {
      cr.dispatchSimpleEvent(this, NativeLayer.EventType.SETTINGS_INVALID);
    },

    /**
     * @param {{contentWidth: number, contentHeight: number, marginLeft: number,
     *          marginRight: number, marginTop: number, marginBottom: number,
     *          printableAreaX: number, printableAreaY: number,
     *          printableAreaWidth: number, printableAreaHeight: number}}
     *          pageLayout Specifies default page layout details in points.
     * @param {boolean} hasCustomPageSizeStyle Indicates whether the previewed
     *     document has a custom page size style.
     * @private
     */
    onDidGetDefaultPageLayout_: function(pageLayout, hasCustomPageSizeStyle) {
      var pageLayoutChangeEvent = new Event(
          NativeLayer.EventType.PAGE_LAYOUT_READY);
      pageLayoutChangeEvent.pageLayout = pageLayout;
      pageLayoutChangeEvent.hasCustomPageSizeStyle = hasCustomPageSizeStyle;
      this.dispatchEvent(pageLayoutChangeEvent);
    },

    /**
     * Update the page count and check the page range.
     * Called from PrintPreviewUI::OnDidGetPreviewPageCount().
     * @param {number} pageCount The number of pages.
     * @param {number} previewResponseId The preview request id that resulted in
     *      this response.
     * @private
     */
    onDidGetPreviewPageCount_: function(pageCount, previewResponseId) {
      var pageCountChangeEvent = new Event(
          NativeLayer.EventType.PAGE_COUNT_READY);
      pageCountChangeEvent.pageCount = pageCount;
      pageCountChangeEvent.previewResponseId = previewResponseId;
      this.dispatchEvent(pageCountChangeEvent);
    },

    /**
     * Notification that a print preview page has been rendered.
     * Check if the settings have changed and request a regeneration if needed.
     * Called from PrintPreviewUI::OnDidPreviewPage().
     * @param {number} pageNumber The page number, 0-based.
     * @param {number} previewUid Preview unique identifier.
     * @param {number} previewResponseId The preview request id that resulted in
     *     this response.
     * @private
     */
    onDidPreviewPage_: function(pageNumber, previewUid, previewResponseId) {
      var pagePreviewGenEvent = new Event(
          NativeLayer.EventType.PAGE_PREVIEW_READY);
      pagePreviewGenEvent.pageIndex = pageNumber;
      pagePreviewGenEvent.previewUid = previewUid;
      pagePreviewGenEvent.previewResponseId = previewResponseId;
      this.dispatchEvent(pagePreviewGenEvent);
    },

    /**
     * Notification that access token is ready.
     * @param {string} authType Type of access token.
     * @param {string} accessToken Access token.
     * @private
     */
    onDidGetAccessToken_: function(authType, accessToken) {
      var getAccessTokenEvent = new Event(
          NativeLayer.EventType.ACCESS_TOKEN_READY);
      getAccessTokenEvent.authType = authType;
      getAccessTokenEvent.accessToken = accessToken;
      this.dispatchEvent(getAccessTokenEvent);
    },

    /**
     * Update the print preview when new preview data is available.
     * Create the PDF plugin as needed.
     * Called from PrintPreviewUI::PreviewDataIsAvailable().
     * @param {number} previewUid Preview unique identifier.
     * @param {number} previewResponseId The preview request id that resulted in
     *     this response.
     * @private
     */
    onUpdatePrintPreview_: function(previewUid, previewResponseId) {
      var previewGenDoneEvent = new Event(
          NativeLayer.EventType.PREVIEW_GENERATION_DONE);
      previewGenDoneEvent.previewUid = previewUid;
      previewGenDoneEvent.previewResponseId = previewResponseId;
      this.dispatchEvent(previewGenDoneEvent);
    },

    /**
     * Updates print preset options from source PDF document.
     * Called from PrintPreviewUI::OnSetOptionsFromDocument().
     * @param {{disableScaling: boolean, copies: number,
     *          duplex: number}} options Specifies
     *     printing options according to source document presets.
     * @private
     */
    onPrintPresetOptionsFromDocument_: function(options) {
      var printPresetOptionsEvent = new Event(
          NativeLayer.EventType.PRINT_PRESET_OPTIONS);
      printPresetOptionsEvent.optionsFromDocument = options;
      this.dispatchEvent(printPresetOptionsEvent);
    },

    /**
     * Simulates a user click on the print preview dialog cancel button. Used
     * only for testing.
     * @private
     */
    autoCancelForTesting_: function() {
      var properties = {view: window, bubbles: true, cancelable: true};
      var click = new MouseEvent('click', properties);
      document.querySelector('#print-header .cancel').dispatchEvent(click);
    },

    /**
     * @param {{serviceName: string, name: string}} printer Specifies
     *     information about the printer that was added.
     * @private
     */
    onPrivetPrinterChanged_: function(printer) {
      var privetPrinterChangedEvent =
            new Event(NativeLayer.EventType.PRIVET_PRINTER_CHANGED);
      privetPrinterChangedEvent.printer = printer;
      this.dispatchEvent(privetPrinterChangedEvent);
    },

    /**
     * @param {Object} printer Specifies information about the printer that was
     *    added.
     * @private
     */
    onPrivetCapabilitiesSet_: function(printer, capabilities) {
      var privetCapabilitiesSetEvent =
            new Event(NativeLayer.EventType.PRIVET_CAPABILITIES_SET);
      privetCapabilitiesSetEvent.printer = printer;
      privetCapabilitiesSetEvent.capabilities = capabilities;
      this.dispatchEvent(privetCapabilitiesSetEvent);
    },

    /**
     * @param {string} http_error The HTTP response code or -1 if not an HTTP
     *    error.
     * @private
     */
    onPrivetPrintFailed_: function(http_error) {
      var privetPrintFailedEvent =
            new Event(NativeLayer.EventType.PRIVET_PRINT_FAILED);
      privetPrintFailedEvent.httpError = http_error;
      this.dispatchEvent(privetPrintFailedEvent);
    },

    /**
     * @param {Array<!{extensionId: string,
     *                 extensionName: string,
     *                 id: string,
     *                 name: string,
     *                 description: (string|undefined),
     *                 provisional: (boolean|undefined)}>} printers The list
     *     containing information about printers added by an extension.
     * @param {boolean} done Whether this is the final list of extension
     *     managed printers.
     */
    onExtensionPrintersAdded_: function(printers, done) {
      var event = new Event(NativeLayer.EventType.EXTENSION_PRINTERS_ADDED);
      event.printers = printers;
      event.done = done;
      this.dispatchEvent(event);
    },

    /**
     * Called when an extension responds to a request for an extension printer
     * capabilities.
     * @param {string} printerId The printer's ID.
     * @param {!Object} capabilities The reported printer capabilities.
     */
    onExtensionCapabilitiesSet_: function(printerId,
                                          capabilities) {
      var event = new Event(NativeLayer.EventType.EXTENSION_CAPABILITIES_SET);
      event.printerId = printerId;
      event.capabilities = capabilities;
      this.dispatchEvent(event);
    },

    /**
     * Called when Chrome reports that attempt to resolve a provisional
     * destination failed.
     * @param {string} destinationId The provisional destination ID.
     * @private
     */
    failedToResolveProvisionalDestination_: function(destinationId) {
      var evt = new Event(
          NativeLayer.EventType.PROVISIONAL_DESTINATION_RESOLVED);
      evt.provisionalId = destinationId;
      evt.destination = null;
      this.dispatchEvent(evt);
    },

    /**
     * Called when Chrome reports that a provisional destination has been
     * successfully resolved.
     * Currently used only for extension provided destinations.
     * @param {string} provisionalDestinationId The provisional destination id.
     * @param {!{extensionId: string,
     *           extensionName: string,
     *           id: string,
     *           name: string,
     *           description: (string|undefined)}} destinationInfo The resolved
     *     destination info.
     * @private
     */
    onProvisionalDestinationResolved_: function(provisionalDestinationId,
                                                destinationInfo) {
      var evt = new Event(
          NativeLayer.EventType.PROVISIONAL_DESTINATION_RESOLVED);
      evt.provisionalId = provisionalDestinationId;
      evt.destination = destinationInfo;
      this.dispatchEvent(evt);
    },

   /**
     * Allows for onManipulateSettings to be called
     * from the native layer.
     * @private
     */
    onEnableManipulateSettingsForTest_: function() {
      global.onManipulateSettingsForTest =
          this.onManipulateSettingsForTest_.bind(this);
    },

    /**
     * Dispatches an event to print_preview.js to change
     * a particular setting for print preview.
     * @param {!print_preview.PreviewSettings} settings Object containing the
     *     value to be changed and that value should be set to.
     * @private
     */
    onManipulateSettingsForTest_: function(settings) {
      var manipulateSettingsEvent =
          new Event(NativeLayer.EventType.MANIPULATE_SETTINGS_FOR_TEST);
      manipulateSettingsEvent.settings = settings;
      this.dispatchEvent(manipulateSettingsEvent);
    },

    /**
     * Sends a message to the test, letting it know that an
     * option has been set to a particular value and that the change has
     * finished modifying the preview area.
     */
    previewReadyForTest: function() {
      if (global.onManipulateSettingsForTest)
        chrome.send('UILoadedForTest');
    },

    /**
     * Notifies the test that the option it tried to change
     * had not been changed successfully.
     */
    previewFailedForTest: function() {
      if (global.onManipulateSettingsForTest)
        chrome.send('UIFailedLoadingForTest');
    }
  };

  /**
   * Initial settings retrieved from the native layer.
   * @param {boolean} isInKioskAutoPrintMode Whether the print preview should be
   *     in auto-print mode.
   * @param {boolean} isInAppKioskMode Whether the print preview is in App Kiosk
   *     mode.
   * @param {string} thousandsDelimeter Character delimeter of thousands digits.
   * @param {string} decimalDelimeter Character delimeter of the decimal point.
   * @param {!print_preview.MeasurementSystem.UnitType} unitType Unit type of
   *     local machine's measurement system.
   * @param {boolean} isDocumentModifiable Whether the document to print is
   *     modifiable.
   * @param {string} documentTitle Title of the document.
   * @param {boolean} documentHasSelection Whether the document has selected
   *     content.
   * @param {boolean} selectionOnly Whether only selected content should be
   *     printed.
   * @param {?string} systemDefaultDestinationId ID of the system default
   *     destination.
   * @param {?string} serializedAppStateStr Serialized app state.
   * @param {?string} serializedDefaultDestinationSelectionRulesStr Serialized
   *     default destination selection rules.
   * @constructor
   */
  function NativeInitialSettings(
      isInKioskAutoPrintMode,
      isInAppKioskMode,
      thousandsDelimeter,
      decimalDelimeter,
      unitType,
      isDocumentModifiable,
      documentTitle,
      documentHasSelection,
      selectionOnly,
      systemDefaultDestinationId,
      serializedAppStateStr,
      serializedDefaultDestinationSelectionRulesStr) {

    /**
     * Whether the print preview should be in auto-print mode.
     * @type {boolean}
     * @private
     */
    this.isInKioskAutoPrintMode_ = isInKioskAutoPrintMode;

    /**
     * Whether the print preview should switch to App Kiosk mode.
     * @type {boolean}
     * @private
     */
    this.isInAppKioskMode_ = isInAppKioskMode;

    /**
     * Character delimeter of thousands digits.
     * @type {string}
     * @private
     */
    this.thousandsDelimeter_ = thousandsDelimeter;

    /**
     * Character delimeter of the decimal point.
     * @type {string}
     * @private
     */
    this.decimalDelimeter_ = decimalDelimeter;

    /**
     * Unit type of local machine's measurement system.
     * @type {string}
     * @private
     */
    this.unitType_ = unitType;

    /**
     * Whether the document to print is modifiable.
     * @type {boolean}
     * @private
     */
    this.isDocumentModifiable_ = isDocumentModifiable;

    /**
     * Title of the document.
     * @type {string}
     * @private
     */
    this.documentTitle_ = documentTitle;

    /**
     * Whether the document has selection.
     * @type {string}
     * @private
     */
    this.documentHasSelection_ = documentHasSelection;

    /**
     * Whether selection only should be printed.
     * @type {string}
     * @private
     */
    this.selectionOnly_ = selectionOnly;

    /**
     * ID of the system default destination.
     * @type {?string}
     * @private
     */
    this.systemDefaultDestinationId_ = systemDefaultDestinationId;

    /**
     * Serialized app state.
     * @type {?string}
     * @private
     */
    this.serializedAppStateStr_ = serializedAppStateStr;

    /**
     * Serialized default destination selection rules.
     * @type {?string}
     * @private
     */
    this.serializedDefaultDestinationSelectionRulesStr_ =
        serializedDefaultDestinationSelectionRulesStr;
  };

  NativeInitialSettings.prototype = {
    /**
     * @return {boolean} Whether the print preview should be in auto-print mode.
     */
    get isInKioskAutoPrintMode() {
      return this.isInKioskAutoPrintMode_;
    },

    /**
     * @return {boolean} Whether the print preview should switch to App Kiosk
     *     mode.
     */
    get isInAppKioskMode() {
      return this.isInAppKioskMode_;
    },

    /** @return {string} Character delimeter of thousands digits. */
    get thousandsDelimeter() {
      return this.thousandsDelimeter_;
    },

    /** @return {string} Character delimeter of the decimal point. */
    get decimalDelimeter() {
      return this.decimalDelimeter_;
    },

    /**
     * @return {!print_preview.MeasurementSystem.UnitType} Unit type of local
     *     machine's measurement system.
     */
    get unitType() {
      return this.unitType_;
    },

    /** @return {boolean} Whether the document to print is modifiable. */
    get isDocumentModifiable() {
      return this.isDocumentModifiable_;
    },

    /** @return {string} Document title. */
    get documentTitle() {
      return this.documentTitle_;
    },

    /** @return {boolean} Whether the document has selection. */
    get documentHasSelection() {
      return this.documentHasSelection_;
    },

    /** @return {boolean} Whether selection only should be printed. */
    get selectionOnly() {
      return this.selectionOnly_;
    },

    /** @return {?string} ID of the system default destination. */
    get systemDefaultDestinationId() {
      return this.systemDefaultDestinationId_;
    },

    /** @return {?string} Serialized app state. */
    get serializedAppStateStr() {
      return this.serializedAppStateStr_;
    },

    /** @return {?string} Serialized default destination selection rules. */
    get serializedDefaultDestinationSelectionRulesStr() {
      return this.serializedDefaultDestinationSelectionRulesStr_;
    }
  };

  // Export
  return {
    NativeInitialSettings: NativeInitialSettings,
    NativeLayer: NativeLayer
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Counter used to give webkit animations unique names.
var animationCounter = 0;

var animationEventTracker_ = new EventTracker();

function addAnimation(code) {
  var name = 'anim' + animationCounter;
  animationCounter++;
  var rules = document.createTextNode(
      '@-webkit-keyframes ' + name + ' {' + code + '}');
  var el = document.createElement('style');
  el.type = 'text/css';
  el.appendChild(rules);
  el.setAttribute('id', name);
  document.body.appendChild(el);

  return name;
}

/**
 * Generates css code for fading in an element by animating the height.
 * @param {number} targetHeight The desired height in pixels after the animation
 *     ends.
 * @return {string} The css code for the fade in animation.
 */
function getFadeInAnimationCode(targetHeight) {
  return '0% { opacity: 0; height: 0; } ' +
      '80% { opacity: 0.5; height: ' + (targetHeight + 4) + 'px; }' +
      '100% { opacity: 1; height: ' + targetHeight + 'px; }';
}

/**
 * Fades in an element. Used for both printing options and error messages
 * appearing underneath the textfields.
 * @param {HTMLElement} el The element to be faded in.
 * @param {boolean=} opt_justShow Whether {@code el} should be shown with no
 *     animation.
 */
function fadeInElement(el, opt_justShow) {
  if (el.classList.contains('visible'))
    return;
  el.classList.remove('closing');
  el.hidden = false;
  el.setAttribute('aria-hidden', 'false');
  el.style.height = 'auto';
  var height = el.offsetHeight;
  if (opt_justShow) {
    el.style.height = '';
    el.style.opacity = '';
  } else {
    el.style.height = height + 'px';
    var animName = addAnimation(getFadeInAnimationCode(height));
    animationEventTracker_.add(
        el, 'webkitAnimationEnd', onFadeInAnimationEnd.bind(el), false);
    el.style.webkitAnimationName = animName;
  }
  el.classList.add('visible');
}

/**
 * Fades out an element. Used for both printing options and error messages
 * appearing underneath the textfields.
 * @param {HTMLElement} el The element to be faded out.
 */
function fadeOutElement(el) {
  if (!el.classList.contains('visible'))
    return;
  fadeInAnimationCleanup(el);
  el.style.height = 'auto';
  var height = el.offsetHeight;
  el.style.height = height + 'px';
  el.offsetHeight;  // Should force an update of the computed style.
  animationEventTracker_.add(
      el, 'webkitTransitionEnd', onFadeOutTransitionEnd.bind(el), false);
  el.classList.add('closing');
  el.classList.remove('visible');
  el.setAttribute('aria-hidden', 'true');
}

/**
 * Executes when a fade out animation ends.
 * @param {WebkitTransitionEvent} event The event that triggered this listener.
 * @this {HTMLElement} The element where the transition occurred.
 */
function onFadeOutTransitionEnd(event) {
  if (event.propertyName != 'height')
    return;
  animationEventTracker_.remove(this, 'webkitTransitionEnd');
  this.hidden = true;
}

/**
 * Executes when a fade in animation ends.
 * @param {WebkitAnimationEvent} event The event that triggered this listener.
 * @this {HTMLElement} The element where the transition occurred.
 */
function onFadeInAnimationEnd(event) {
  this.style.height = '';
  fadeInAnimationCleanup(this);
}

/**
 * Removes the <style> element corresponding to |animationName| from the DOM.
 * @param {HTMLElement} element The animated element.
 */
function fadeInAnimationCleanup(element) {
  if (element.style.webkitAnimationName) {
    var animEl = document.getElementById(element.style.webkitAnimationName);
    if (animEl)
      animEl.parentNode.removeChild(animEl);
    element.style.webkitAnimationName = '';
    animationEventTracker_.remove(element, 'webkitAnimationEnd');
  }
}

/**
 * Fades in a printing option existing under |el|.
 * @param {HTMLElement} el The element to hide.
 * @param {boolean=} opt_justShow Whether {@code el} should be hidden with no
 *     animation.
 */
function fadeInOption(el, opt_justShow) {
  if (el.classList.contains('visible'))
    return;
  // To make the option visible during the first fade in.
  el.hidden = false;

  var leftColumn = el.querySelector('.left-column');
  wrapContentsInDiv(leftColumn, ['invisible']);
  var rightColumn = el.querySelector('.right-column');
  wrapContentsInDiv(rightColumn, ['invisible']);

  var toAnimate = el.querySelectorAll('.collapsible');
  for (var i = 0; i < toAnimate.length; i++)
    fadeInElement(toAnimate[i], opt_justShow);
  el.classList.add('visible');
}

/**
 * Fades out a printing option existing under |el|.
 * @param {HTMLElement} el The element to hide.
 * @param {boolean=} opt_justHide Whether {@code el} should be hidden with no
 *     animation.
 */
function fadeOutOption(el, opt_justHide) {
  if (!el.classList.contains('visible'))
    return;

  var leftColumn = el.querySelector('.left-column');
  wrapContentsInDiv(leftColumn, ['visible']);
  var rightColumn = el.querySelector('.right-column');
  wrapContentsInDiv(rightColumn, ['visible']);

  var toAnimate = el.querySelectorAll('.collapsible');
  for (var i = 0; i < toAnimate.length; i++) {
    if (opt_justHide) {
      toAnimate[i].hidden = true;
      toAnimate[i].classList.add('closing');
      toAnimate[i].classList.remove('visible');
    } else {
      fadeOutElement(toAnimate[i]);
    }
  }
  el.classList.remove('visible');
}

/**
 * Wraps the contents of |el| in a div element and attaches css classes
 * |classes| in the new div, only if has not been already done. It is necessary
 * for animating the height of table cells.
 * @param {HTMLElement} el The element to be processed.
 * @param {array} classes The css classes to add.
 */
function wrapContentsInDiv(el, classes) {
  var div = el.querySelector('div');
  if (!div || !div.classList.contains('collapsible')) {
    div = document.createElement('div');
    while (el.childNodes.length > 0)
      div.appendChild(el.firstChild);
    el.appendChild(div);
  }

  div.className = '';
  div.classList.add('collapsible');
  for (var i = 0; i < classes.length; i++)
    div.classList.add(classes[i]);
}

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('cloudprint', function() {
  'use strict';

  /**
   * API to the Google Cloud Print service.
   * @param {string} baseUrl Base part of the Google Cloud Print service URL
   *     with no trailing slash. For example,
   *     'https://www.google.com/cloudprint'.
   * @param {!print_preview.NativeLayer} nativeLayer Native layer used to get
   *     Auth2 tokens.
   * @param {!print_preview.UserInfo} userInfo User information repository.
   * @param {boolean} isInAppKioskMode Whether the print preview is in App
   *     Kiosk mode.
   * @constructor
   * @extends {cr.EventTarget}
   */
  function CloudPrintInterface(
      baseUrl, nativeLayer, userInfo, isInAppKioskMode) {
    /**
     * The base URL of the Google Cloud Print API.
     * @type {string}
     * @private
     */
    this.baseUrl_ = baseUrl;

    /**
     * Used to get Auth2 tokens.
     * @type {!print_preview.NativeLayer}
     * @private
     */
    this.nativeLayer_ = nativeLayer;

    /**
     * User information repository.
     * @type {!print_preview.UserInfo}
     * @private
     */
    this.userInfo_ = userInfo;

    /**
     * Whether Print Preview is in App Kiosk mode, basically, use only printers
     * available for the device.
     * @type {boolean}
     * @private
     */
    this.isInAppKioskMode_ = isInAppKioskMode;

    /**
     * Currently logged in users (identified by email) mapped to the Google
     * session index.
     * @type {!Object<number>}
     * @private
     */
    this.userSessionIndex_ = {};

    /**
     * Stores last received XSRF tokens for each user account. Sent as
     * a parameter with every request.
     * @type {!Object<string>}
     * @private
     */
    this.xsrfTokens_ = {};

    /**
     * Pending requests delayed until we get access token.
     * @type {!Array<!CloudPrintRequest>}
     * @private
     */
    this.requestQueue_ = [];

    /**
     * Outstanding cloud destination search requests.
     * @type {!Array<!CloudPrintRequest>}
     * @private
     */
    this.outstandingCloudSearchRequests_ = [];

    /**
     * Event tracker used to keep track of native layer events.
     * @type {!EventTracker}
     * @private
     */
    this.tracker_ = new EventTracker();

    this.addEventListeners_();
  };

  /**
   * Event types dispatched by the interface.
   * @enum {string}
   */
  CloudPrintInterface.EventType = {
    INVITES_DONE: 'cloudprint.CloudPrintInterface.INVITES_DONE',
    INVITES_FAILED: 'cloudprint.CloudPrintInterface.INVITES_FAILED',
    PRINTER_DONE: 'cloudprint.CloudPrintInterface.PRINTER_DONE',
    PRINTER_FAILED: 'cloudprint.CloudPrintInterface.PRINTER_FAILED',
    PROCESS_INVITE_DONE: 'cloudprint.CloudPrintInterface.PROCESS_INVITE_DONE',
    PROCESS_INVITE_FAILED:
        'cloudprint.CloudPrintInterface.PROCESS_INVITE_FAILED',
    SEARCH_DONE: 'cloudprint.CloudPrintInterface.SEARCH_DONE',
    SEARCH_FAILED: 'cloudprint.CloudPrintInterface.SEARCH_FAILED',
    SUBMIT_DONE: 'cloudprint.CloudPrintInterface.SUBMIT_DONE',
    SUBMIT_FAILED: 'cloudprint.CloudPrintInterface.SUBMIT_FAILED',
    UPDATE_PRINTER_TOS_ACCEPTANCE_FAILED:
        'cloudprint.CloudPrintInterface.UPDATE_PRINTER_TOS_ACCEPTANCE_FAILED'
  };

  /**
   * Content type header value for a URL encoded HTTP request.
   * @type {string}
   * @const
   * @private
   */
  CloudPrintInterface.URL_ENCODED_CONTENT_TYPE_ =
      'application/x-www-form-urlencoded';

  /**
   * Multi-part POST request boundary used in communication with Google
   * Cloud Print.
   * @type {string}
   * @const
   * @private
   */
  CloudPrintInterface.MULTIPART_BOUNDARY_ =
      '----CloudPrintFormBoundaryjc9wuprokl8i';

  /**
   * Content type header value for a multipart HTTP request.
   * @type {string}
   * @const
   * @private
   */
  CloudPrintInterface.MULTIPART_CONTENT_TYPE_ =
      'multipart/form-data; boundary=' +
      CloudPrintInterface.MULTIPART_BOUNDARY_;

  /**
   * Regex that extracts Chrome's version from the user-agent string.
   * @type {!RegExp}
   * @const
   * @private
   */
  CloudPrintInterface.VERSION_REGEXP_ = /.*Chrome\/([\d\.]+)/i;

  /**
   * Enumeration of JSON response fields from Google Cloud Print API.
   * @enum {string}
   * @private
   */
  CloudPrintInterface.JsonFields_ = {
    PRINTER: 'printer'
  };

  /**
   * Could Print origins used to search printers.
   * @type {!Array<!print_preview.Destination.Origin>}
   * @const
   * @private
   */
  CloudPrintInterface.CLOUD_ORIGINS_ = [
      print_preview.Destination.Origin.COOKIES,
      print_preview.Destination.Origin.DEVICE
      // TODO(vitalybuka): Enable when implemented.
      // ready print_preview.Destination.Origin.PROFILE
  ];

  CloudPrintInterface.prototype = {
    __proto__: cr.EventTarget.prototype,

    /** @return {string} Base URL of the Google Cloud Print service. */
    get baseUrl() {
      return this.baseUrl_;
    },

    /**
     * @return {boolean} Whether a search for cloud destinations is in progress.
     */
    get isCloudDestinationSearchInProgress() {
      return this.outstandingCloudSearchRequests_.length > 0;
    },

    /**
     * Sends Google Cloud Print search API request.
     * @param {string=} opt_account Account the search is sent for. When
     *      omitted, the search is done on behalf of the primary user.
     * @param {print_preview.Destination.Origin=} opt_origin When specified,
     *     searches destinations for {@code opt_origin} only, otherwise starts
     *     searches for all origins.
     */
    search: function(opt_account, opt_origin) {
      var account = opt_account || '';
      var origins =
          opt_origin && [opt_origin] || CloudPrintInterface.CLOUD_ORIGINS_;
      if (this.isInAppKioskMode_) {
        origins = origins.filter(function(origin) {
          return origin != print_preview.Destination.Origin.COOKIES;
        });
      }
      this.abortSearchRequests_(origins);
      this.search_(true, account, origins);
      this.search_(false, account, origins);
    },

    /**
     * Sends Google Cloud Print search API requests.
     * @param {boolean} isRecent Whether to search for only recently used
     *     printers.
     * @param {string} account Account the search is sent for. It matters for
     *     COOKIES origin only, and can be empty (sent on behalf of the primary
     *     user in this case).
     * @param {!Array<!print_preview.Destination.Origin>} origins Origins to
     *     search printers for.
     * @private
     */
    search_: function(isRecent, account, origins) {
      var params = [
        new HttpParam('connection_status', 'ALL'),
        new HttpParam('client', 'chrome'),
        new HttpParam('use_cdd', 'true')
      ];
      if (isRecent) {
        params.push(new HttpParam('q', '^recent'));
      }
      origins.forEach(function(origin) {
        var cpRequest = this.buildRequest_(
            'GET',
            'search',
            params,
            origin,
            account,
            this.onSearchDone_.bind(this, isRecent));
        this.outstandingCloudSearchRequests_.push(cpRequest);
        this.sendOrQueueRequest_(cpRequest);
      }, this);
    },

    /**
     * Sends Google Cloud Print printer sharing invitations API requests.
     * @param {string} account Account the request is sent for.
     */
    invites: function(account) {
      var params = [
        new HttpParam('client', 'chrome'),
      ];
      this.sendOrQueueRequest_(this.buildRequest_(
          'GET',
          'invites',
          params,
          print_preview.Destination.Origin.COOKIES,
          account,
          this.onInvitesDone_.bind(this)));
    },

    /**
     * Accepts or rejects printer sharing invitation.
     * @param {!print_preview.Invitation} invitation Invitation to process.
     * @param {boolean} accept Whether to accept this invitation.
     */
    processInvite: function(invitation, accept) {
      var params = [
        new HttpParam('printerid', invitation.destination.id),
        new HttpParam('email', invitation.scopeId),
        new HttpParam('accept', accept),
        new HttpParam('use_cdd', true),
      ];
      this.sendOrQueueRequest_(this.buildRequest_(
          'POST',
          'processinvite',
          params,
          invitation.destination.origin,
          invitation.destination.account,
          this.onProcessInviteDone_.bind(this, invitation, accept)));
    },

    /**
     * Sends a Google Cloud Print submit API request.
     * @param {!print_preview.Destination} destination Cloud destination to
     *     print to.
     * @param {!print_preview.PrintTicketStore} printTicketStore Contains the
     *     print ticket to print.
     * @param {!print_preview.DocumentInfo} documentInfo Document data model.
     * @param {string} data Base64 encoded data of the document.
     */
    submit: function(destination, printTicketStore, documentInfo, data) {
      var result =
          CloudPrintInterface.VERSION_REGEXP_.exec(navigator.userAgent);
      var chromeVersion = 'unknown';
      if (result && result.length == 2) {
        chromeVersion = result[1];
      }
      var params = [
        new HttpParam('printerid', destination.id),
        new HttpParam('contentType', 'dataUrl'),
        new HttpParam('title', documentInfo.title),
        new HttpParam('ticket',
                      printTicketStore.createPrintTicket(destination)),
        new HttpParam('content', 'data:application/pdf;base64,' + data),
        new HttpParam('tag',
                      '__google__chrome_version=' + chromeVersion),
        new HttpParam('tag', '__google__os=' + navigator.platform)
      ];
      var cpRequest = this.buildRequest_(
          'POST',
          'submit',
          params,
          destination.origin,
          destination.account,
          this.onSubmitDone_.bind(this));
      this.sendOrQueueRequest_(cpRequest);
    },

    /**
     * Sends a Google Cloud Print printer API request.
     * @param {string} printerId ID of the printer to lookup.
     * @param {!print_preview.Destination.Origin} origin Origin of the printer.
     * @param {string=} account Account this printer is registered for. When
     *     provided for COOKIES {@code origin}, and users sessions are still not
     *     known, will be checked against the response (both success and failure
     *     to get printer) and, if the active user account is not the one
     *     requested, {@code account} is activated and printer request reissued.
     */
    printer: function(printerId, origin, account) {
      var params = [
        new HttpParam('printerid', printerId),
        new HttpParam('use_cdd', 'true'),
        new HttpParam('printer_connection_status', 'true')
      ];
      this.sendOrQueueRequest_(this.buildRequest_(
          'GET',
          'printer',
          params,
          origin,
          account,
          this.onPrinterDone_.bind(this, printerId)));
    },

    /**
     * Sends a Google Cloud Print update API request to accept (or reject) the
     * terms-of-service of the given printer.
     * @param {!print_preview.Destination} destination Destination to accept ToS
     *     for.
     * @param {boolean} isAccepted Whether the user accepted ToS or not.
     */
    updatePrinterTosAcceptance: function(destination, isAccepted) {
      var params = [
        new HttpParam('printerid', destination.id),
        new HttpParam('is_tos_accepted', isAccepted)
      ];
      this.sendOrQueueRequest_(this.buildRequest_(
          'POST',
          'update',
          params,
          destination.origin,
          destination.account,
          this.onUpdatePrinterTosAcceptanceDone_.bind(this)));
    },

    /**
     * Adds event listeners to relevant events.
     * @private
     */
    addEventListeners_: function() {
      this.tracker_.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.ACCESS_TOKEN_READY,
          this.onAccessTokenReady_.bind(this));
    },

    /**
     * Builds request to the Google Cloud Print API.
     * @param {string} method HTTP method of the request.
     * @param {string} action Google Cloud Print action to perform.
     * @param {Array<!HttpParam>} params HTTP parameters to include in the
     *     request.
     * @param {!print_preview.Destination.Origin} origin Origin for destination.
     * @param {?string} account Account the request is sent for. Can be
     *     {@code null} or empty string if the request is not cookie bound or
     *     is sent on behalf of the primary user.
     * @param {function(number, Object, !print_preview.Destination.Origin)}
     *     callback Callback to invoke when request completes.
     * @return {!CloudPrintRequest} Partially prepared request.
     * @private
     */
    buildRequest_: function(method, action, params, origin, account, callback) {
      var url = this.baseUrl_ + '/' + action + '?xsrf=';
      if (origin == print_preview.Destination.Origin.COOKIES) {
        var xsrfToken = this.xsrfTokens_[account];
        if (!xsrfToken) {
          // TODO(rltoscano): Should throw an error if not a read-only action or
          // issue an xsrf token request.
        } else {
          url = url + xsrfToken;
        }
        if (account) {
          var index = this.userSessionIndex_[account] || 0;
          if (index > 0) {
            url += '&user=' + index;
          }
        }
      }
      var body = null;
      if (params) {
        if (method == 'GET') {
          url = params.reduce(function(partialUrl, param) {
            return partialUrl + '&' + param.name + '=' +
                encodeURIComponent(param.value);
          }, url);
        } else if (method == 'POST') {
          body = params.reduce(function(partialBody, param) {
            return partialBody + 'Content-Disposition: form-data; name=\"' +
                param.name + '\"\r\n\r\n' + param.value + '\r\n--' +
                CloudPrintInterface.MULTIPART_BOUNDARY_ + '\r\n';
          }, '--' + CloudPrintInterface.MULTIPART_BOUNDARY_ + '\r\n');
        }
      }

      var headers = {};
      headers['X-CloudPrint-Proxy'] = 'ChromePrintPreview';
      if (method == 'GET') {
        headers['Content-Type'] = CloudPrintInterface.URL_ENCODED_CONTENT_TYPE_;
      } else if (method == 'POST') {
        headers['Content-Type'] = CloudPrintInterface.MULTIPART_CONTENT_TYPE_;
      }

      var xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.withCredentials =
          (origin == print_preview.Destination.Origin.COOKIES);
      for (var header in headers) {
        xhr.setRequestHeader(header, headers[header]);
      }

      return new CloudPrintRequest(xhr, body, origin, account, callback);
    },

    /**
     * Sends a request to the Google Cloud Print API or queues if it needs to
     *     wait OAuth2 access token.
     * @param {!CloudPrintRequest} request Request to send or queue.
     * @private
     */
    sendOrQueueRequest_: function(request) {
      if (request.origin == print_preview.Destination.Origin.COOKIES) {
        return this.sendRequest_(request);
      } else {
        this.requestQueue_.push(request);
        this.nativeLayer_.startGetAccessToken(request.origin);
      }
    },

    /**
     * Sends a request to the Google Cloud Print API.
     * @param {!CloudPrintRequest} request Request to send.
     * @private
     */
    sendRequest_: function(request) {
      request.xhr.onreadystatechange =
          this.onReadyStateChange_.bind(this, request);
      request.xhr.send(request.body);
    },

    /**
     * Creates a Google Cloud Print interface error that is ready to dispatch.
     * @param {!CloudPrintInterface.EventType} type Type of the error.
     * @param {!CloudPrintRequest} request Request that has been completed.
     * @return {!Event} Google Cloud Print interface error event.
     * @private
     */
    createErrorEvent_: function(type, request) {
      var errorEvent = new Event(type);
      errorEvent.status = request.xhr.status;
      if (request.xhr.status == 200) {
        errorEvent.errorCode = request.result['errorCode'];
        errorEvent.message = request.result['message'];
      } else {
        errorEvent.errorCode = 0;
        errorEvent.message = '';
      }
      errorEvent.origin = request.origin;
      return errorEvent;
    },

    /**
     * Updates user info and session index from the {@code request} response.
     * @param {!CloudPrintRequest} request Request to extract user info from.
     * @private
     */
    setUsers_: function(request) {
      if (request.origin == print_preview.Destination.Origin.COOKIES) {
        var users = request.result['request']['users'] || [];
        this.userSessionIndex_ = {};
        for (var i = 0; i < users.length; i++) {
          this.userSessionIndex_[users[i]] = i;
        }
        this.userInfo_.setUsers(request.result['request']['user'], users);
      }
    },

    /**
     * Terminates search requests for requested {@code origins}.
     * @param {!Array<print_preview.Destination.Origin>} origins Origins
     *     to terminate search requests for.
     * @private
     */
    abortSearchRequests_: function(origins) {
      this.outstandingCloudSearchRequests_ =
          this.outstandingCloudSearchRequests_.filter(function(request) {
            if (origins.indexOf(request.origin) >= 0) {
              request.xhr.abort();
              return false;
            }
            return true;
          });
    },

    /**
     * Called when a native layer receives access token.
     * @param {Event} event Contains the authentication type and access token.
     * @private
     */
    onAccessTokenReady_: function(event) {
      // TODO(vitalybuka): remove when other Origins implemented.
      assert(event.authType == print_preview.Destination.Origin.DEVICE);
      this.requestQueue_ = this.requestQueue_.filter(function(request) {
        assert(request.origin == print_preview.Destination.Origin.DEVICE);
        if (request.origin != event.authType) {
          return true;
        }
        if (event.accessToken) {
          request.xhr.setRequestHeader('Authorization',
                                       'Bearer ' + event.accessToken);
          this.sendRequest_(request);
        } else {  // No valid token.
          // Without abort status does not exist.
          request.xhr.abort();
          request.callback(request);
        }
        return false;
      }, this);
    },

    /**
     * Called when the ready-state of a XML http request changes.
     * Calls the successCallback with the result or dispatches an ERROR event.
     * @param {!CloudPrintRequest} request Request that was changed.
     * @private
     */
    onReadyStateChange_: function(request) {
      if (request.xhr.readyState == 4) {
        if (request.xhr.status == 200) {
          request.result = JSON.parse(request.xhr.responseText);
          if (request.origin == print_preview.Destination.Origin.COOKIES &&
              request.result['success']) {
            this.xsrfTokens_[request.result['request']['user']] =
                request.result['xsrf_token'];
          }
        }
        request.status = request.xhr.status;
        request.callback(request);
      }
    },

    /**
     * Called when the search request completes.
     * @param {boolean} isRecent Whether the search request was for recent
     *     destinations.
     * @param {!CloudPrintRequest} request Request that has been completed.
     * @private
     */
    onSearchDone_: function(isRecent, request) {
      var lastRequestForThisOrigin = true;
      this.outstandingCloudSearchRequests_ =
          this.outstandingCloudSearchRequests_.filter(function(item) {
            if (item != request && item.origin == request.origin) {
              lastRequestForThisOrigin = false;
            }
            return item != request;
          });
      var activeUser = '';
      if (request.origin == print_preview.Destination.Origin.COOKIES) {
        activeUser =
            request.result &&
            request.result['request'] &&
            request.result['request']['user'];
      }
      var event = null;
      if (request.xhr.status == 200 && request.result['success']) {
        // Extract printers.
        var printerListJson = request.result['printers'] || [];
        var printerList = [];
        printerListJson.forEach(function(printerJson) {
          try {
            printerList.push(cloudprint.CloudDestinationParser.parse(
                printerJson, request.origin, activeUser));
          } catch (err) {
            console.error('Unable to parse cloud print destination: ' + err);
          }
        });
        // Extract and store users.
        this.setUsers_(request);
        // Dispatch SEARCH_DONE event.
        event = new Event(CloudPrintInterface.EventType.SEARCH_DONE);
        event.origin = request.origin;
        event.printers = printerList;
        event.isRecent = isRecent;
      } else {
        event = this.createErrorEvent_(
            CloudPrintInterface.EventType.SEARCH_FAILED,
            request);
      }
      event.user = activeUser;
      event.searchDone = lastRequestForThisOrigin;
      this.dispatchEvent(event);
    },

    /**
     * Called when invitations search request completes.
     * @param {!CloudPrintRequest} request Request that has been completed.
     * @private
     */
    onInvitesDone_: function(request) {
      var event = null;
      var activeUser =
          (request.result &&
           request.result['request'] &&
           request.result['request']['user']) || '';
      if (request.xhr.status == 200 && request.result['success']) {
        // Extract invitations.
        var invitationListJson = request.result['invites'] || [];
        var invitationList = [];
        invitationListJson.forEach(function(invitationJson) {
          try {
            invitationList.push(cloudprint.InvitationParser.parse(
                invitationJson, activeUser));
          } catch (e) {
            console.error('Unable to parse invitation: ' + e);
          }
        });
        // Dispatch INVITES_DONE event.
        event = new Event(CloudPrintInterface.EventType.INVITES_DONE);
        event.invitations = invitationList;
      } else {
        event = this.createErrorEvent_(
            CloudPrintInterface.EventType.INVITES_FAILED, request);
      }
      event.user = activeUser;
      this.dispatchEvent(event);
    },

    /**
     * Called when invitation processing request completes.
     * @param {!print_preview.Invitation} invitation Processed invitation.
     * @param {boolean} accept Whether this invitation was accepted or rejected.
     * @param {!CloudPrintRequest} request Request that has been completed.
     * @private
     */
    onProcessInviteDone_: function(invitation, accept, request) {
      var event = null;
      var activeUser =
          (request.result &&
           request.result['request'] &&
           request.result['request']['user']) || '';
      if (request.xhr.status == 200 && request.result['success']) {
        event = new Event(CloudPrintInterface.EventType.PROCESS_INVITE_DONE);
        if (accept) {
          try {
            event.printer = cloudprint.CloudDestinationParser.parse(
                request.result['printer'], request.origin, activeUser);
          } catch (e) {
            console.error('Failed to parse cloud print destination: ' + e);
          }
        }
      } else {
        event = this.createErrorEvent_(
            CloudPrintInterface.EventType.PROCESS_INVITE_FAILED, request);
      }
      event.invitation = invitation;
      event.accept = accept;
      event.user = activeUser;
      this.dispatchEvent(event);
    },

    /**
     * Called when the submit request completes.
     * @param {!CloudPrintRequest} request Request that has been completed.
     * @private
     */
    onSubmitDone_: function(request) {
      if (request.xhr.status == 200 && request.result['success']) {
        var submitDoneEvent = new Event(
            CloudPrintInterface.EventType.SUBMIT_DONE);
        submitDoneEvent.jobId = request.result['job']['id'];
        this.dispatchEvent(submitDoneEvent);
      } else {
        var errorEvent = this.createErrorEvent_(
            CloudPrintInterface.EventType.SUBMIT_FAILED, request);
        this.dispatchEvent(errorEvent);
      }
    },

    /**
     * Called when the printer request completes.
     * @param {string} destinationId ID of the destination that was looked up.
     * @param {!CloudPrintRequest} request Request that has been completed.
     * @private
     */
    onPrinterDone_: function(destinationId, request) {
      // Special handling of the first printer request. It does not matter at
      // this point, whether printer was found or not.
      if (request.origin == print_preview.Destination.Origin.COOKIES &&
          request.result &&
          request.account &&
          request.result['request']['user'] &&
          request.result['request']['users'] &&
          request.account != request.result['request']['user']) {
        this.setUsers_(request);
        // In case the user account is known, but not the primary one,
        // activate it.
        if (this.userSessionIndex_[request.account] > 0) {
          this.userInfo_.activeUser = request.account;
          // Repeat the request for the newly activated account.
          this.printer(
              request.result['request']['params']['printerid'],
              request.origin,
              request.account);
          // Stop processing this request, wait for the new response.
          return;
        }
      }
      // Process response.
      if (request.xhr.status == 200 && request.result['success']) {
        var activeUser = '';
        if (request.origin == print_preview.Destination.Origin.COOKIES) {
          activeUser = request.result['request']['user'];
        }
        var printerJson = request.result['printers'][0];
        var printer;
        try {
          printer = cloudprint.CloudDestinationParser.parse(
              printerJson, request.origin, activeUser);
        } catch (err) {
          console.error('Failed to parse cloud print destination: ' +
              JSON.stringify(printerJson));
          return;
        }
        var printerDoneEvent =
            new Event(CloudPrintInterface.EventType.PRINTER_DONE);
        printerDoneEvent.printer = printer;
        this.dispatchEvent(printerDoneEvent);
      } else {
        var errorEvent = this.createErrorEvent_(
            CloudPrintInterface.EventType.PRINTER_FAILED, request);
        errorEvent.destinationId = destinationId;
        errorEvent.destinationOrigin = request.origin;
        this.dispatchEvent(errorEvent);
      }
    },

    /**
     * Called when the update printer TOS acceptance request completes.
     * @param {!CloudPrintRequest} request Request that has been completed.
     * @private
     */
    onUpdatePrinterTosAcceptanceDone_: function(request) {
      if (request.xhr.status == 200 && request.result['success']) {
        // Do nothing.
      } else {
        var errorEvent = this.createErrorEvent_(
            CloudPrintInterface.EventType.SUBMIT_FAILED, request);
        this.dispatchEvent(errorEvent);
      }
    }
  };

  /**
   * Data structure that holds data for Cloud Print requests.
   * @param {!XMLHttpRequest} xhr Partially prepared http request.
   * @param {string} body Data to send with POST requests.
   * @param {!print_preview.Destination.Origin} origin Origin for destination.
   * @param {?string} account Account the request is sent for. Can be
   *     {@code null} or empty string if the request is not cookie bound or
   *     is sent on behalf of the primary user.
   * @param {function(!CloudPrintRequest)} callback Callback to invoke when
   *     request completes.
   * @constructor
   */
  function CloudPrintRequest(xhr, body, origin, account, callback) {
    /**
     * Partially prepared http request.
     * @type {!XMLHttpRequest}
     */
    this.xhr = xhr;

    /**
     * Data to send with POST requests.
     * @type {string}
     */
    this.body = body;

    /**
     * Origin for destination.
     * @type {!print_preview.Destination.Origin}
     */
    this.origin = origin;

    /**
     * User account this request is expected to be executed for.
     * @type {?string}
     */
    this.account = account;

    /**
     * Callback to invoke when request completes.
     * @type {function(!CloudPrintRequest)}
     */
    this.callback = callback;

    /**
     * Result for requests.
     * @type {Object} JSON response.
     */
    this.result = null;
  };

  /**
   * Data structure that represents an HTTP parameter.
   * @param {string} name Name of the parameter.
   * @param {string} value Value of the parameter.
   * @constructor
   */
  function HttpParam(name, value) {
    /**
     * Name of the parameter.
     * @type {string}
     */
    this.name = name;

    /**
     * Name of the value.
     * @type {string}
     */
    this.value = value;
  };

  // Export
  return {
    CloudPrintInterface: CloudPrintInterface
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @param {string} toTest The string to be tested.
 * @return {boolean} True if |toTest| contains only digits. Leading and trailing
 *     whitespace is allowed.
 */
function isInteger(toTest) {
  var numericExp = /^\s*[0-9]+\s*$/;
  return numericExp.test(toTest);
}

/**
 * Returns true if |value| is a valid non zero positive integer.
 * @param {string} value The string to be tested.
 * @return {boolean} true if the |value| is valid non zero positive integer.
 */
function isPositiveInteger(value) {
  return isInteger(value) && parseInt(value, 10) > 0;
}

/**
 * Returns true if the contents of the two arrays are equal.
 * @param {Array<{from: number, to: number}>} array1 The first array.
 * @param {Array<{from: number, to: number}>} array2 The second array.
 * @return {boolean} true if the arrays are equal.
 */
function areArraysEqual(array1, array2) {
  if (array1.length != array2.length)
    return false;
  for (var i = 0; i < array1.length; i++)
    if (array1[i] !== array2[i])
      return false;
  return true;
}

/**
 * Returns true if the contents of the two page ranges are equal.
 * @param {Array} array1 The first array.
 * @param {Array} array2 The second array.
 * @return {boolean} true if the arrays are equal.
 */
function areRangesEqual(array1, array2) {
  if (array1.length != array2.length)
    return false;
  for (var i = 0; i < array1.length; i++)
    if (array1[i].from != array2[i].from ||
        array1[i].to != array2[i].to) {
    return false;
  }
  return true;
}

/**
 * Removes duplicate elements from |inArray| and returns a new array.
 * |inArray| is not affected. It assumes that |inArray| is already sorted.
 * @param {!Array<number>} inArray The array to be processed.
 * @return {!Array<number>} The array after processing.
 */
function removeDuplicates(inArray) {
  var out = [];

  if (inArray.length == 0)
    return out;

  out.push(inArray[0]);
  for (var i = 1; i < inArray.length; ++i)
    if (inArray[i] != inArray[i - 1])
      out.push(inArray[i]);
  return out;
}

/** @enum {number} */
var PageRangeStatus = {
  NO_ERROR: 0,
  SYNTAX_ERROR: -1,
  LIMIT_ERROR: -2
};

/**
 * Returns a list of ranges in |pageRangeText|. The ranges are
 * listed in the order they appear in |pageRangeText| and duplicates are not
 * eliminated. If |pageRangeText| is not valid, PageRangeStatus.SYNTAX_ERROR
 * is returned.
 * A valid selection has a parsable format and every page identifier is
 * greater than 0 unless wildcards are used(see examples).
 * If a page is greater than |totalPageCount|, PageRangeStatus.LIMIT_ERROR
 * is returned.
 * If |totalPageCount| is 0 or undefined function uses impossibly large number
 * instead.
 * Wildcard the first number must be larger than 0 and less or equal then
 * |totalPageCount|. If it's missed then 1 is used as the first number.
 * Wildcard the second number must be larger then the first number. If it's
 * missed then |totalPageCount| is used as the second number.
 * Example: "1-4, 9, 3-6, 10, 11" is valid, assuming |totalPageCount| >= 11.
 * Example: "1-4, -6" is valid, assuming |totalPageCount| >= 6.
 * Example: "2-" is valid, assuming |totalPageCount| >= 2, means from 2 to the
 *          end.
 * Example: "4-2, 11, -6" is invalid.
 * Example: "-" is valid, assuming |totalPageCount| >= 1.
 * Example: "1-4dsf, 11" is invalid regardless of |totalPageCount|.
 * @param {string} pageRangeText The text to be checked.
 * @param {number=} opt_totalPageCount The total number of pages.
 * @return {!PageRangeStatus|!Array<{from: number, to: number}>}
 */
function pageRangeTextToPageRanges(pageRangeText, opt_totalPageCount) {
  if (pageRangeText == '') {
    return [];
  }

  var MAX_PAGE_NUMBER = 1000000000;
  var totalPageCount = opt_totalPageCount ? opt_totalPageCount :
                                            MAX_PAGE_NUMBER;

  var regex = /^\s*([0-9]*)\s*-\s*([0-9]*)\s*$/;
  var parts = pageRangeText.split(/,/);

  var pageRanges = [];
  for (var i = 0; i < parts.length; ++i) {
    var match = parts[i].match(regex);
    if (match) {
      if (!isPositiveInteger(match[1]) && match[1] !== '')
        return PageRangeStatus.SYNTAX_ERROR;
      if (!isPositiveInteger(match[2]) && match[2] !== '')
        return PageRangeStatus.SYNTAX_ERROR;
      var from = match[1] ? parseInt(match[1], 10) : 1;
      var to = match[2] ? parseInt(match[2], 10) : totalPageCount;
      if (from > to)
        return PageRangeStatus.SYNTAX_ERROR;
      if (to > totalPageCount)
        return PageRangeStatus.LIMIT_ERROR;
      pageRanges.push({'from': from, 'to': to});
    } else {
      if (!isPositiveInteger(parts[i]))
        return PageRangeStatus.SYNTAX_ERROR;
      var singlePageNumber = parseInt(parts[i], 10);
      if (singlePageNumber > totalPageCount)
        return PageRangeStatus.LIMIT_ERROR;
      pageRanges.push({'from': singlePageNumber, 'to': singlePageNumber});
    }
  }
  return pageRanges;
}

/**
 * Returns a list of pages defined by |pagesRangeText|. The pages are
 * listed in the order they appear in |pageRangeText| and duplicates are not
 * eliminated. If |pageRangeText| is not valid according or
 * |totalPageCount| undefined [1,2,...,totalPageCount] is returned.
 * See pageRangeTextToPageRanges for details.
 * @param {string} pageRangeText The text to be checked.
 * @param {number} totalPageCount The total number of pages.
 * @return {Array<number>} A list of all pages.
 */
function pageRangeTextToPageList(pageRangeText, totalPageCount) {
  var pageRanges = pageRangeTextToPageRanges(pageRangeText, totalPageCount);
  var pageList = [];
  if (pageRanges instanceof Array) {
    for (var i = 0; i < pageRanges.length; ++i) {
      for (var j = pageRanges[i].from; j <= Math.min(pageRanges[i].to,
                                                     totalPageCount); ++j) {
        pageList.push(j);
      }
    }
  }
  if (pageList.length == 0) {
    for (var j = 1; j <= totalPageCount; ++j)
      pageList.push(j);
  }
  return pageList;
}

/**
 * @param {!Array<number>} pageList The list to be processed.
 * @return {!Array<number>} The contents of |pageList| in ascending order and
 *     without any duplicates. |pageList| is not affected.
 */
function pageListToPageSet(pageList) {
  var pageSet = [];
  if (pageList.length == 0)
    return pageSet;
  pageSet = pageList.slice(0);
  pageSet.sort(function(a, b) {
    return /** @type {number} */(a) - /** @type {number} */(b);
  });
  pageSet = removeDuplicates(pageSet);
  return pageSet;
}

/**
 * @param {!HTMLElement} element Element to check for visibility.
 * @return {boolean} Whether the given element is visible.
 */
function getIsVisible(element) {
  return !element.hidden;
}

/**
 * Shows or hides an element.
 * @param {!HTMLElement} element Element to show or hide.
 * @param {boolean} isVisible Whether the element should be visible or not.
 */
function setIsVisible(element, isVisible) {
  element.hidden = !isVisible;
}

/**
 * @param {!Array} array Array to check for item.
 * @param {*} item Item to look for in array.
 * @return {boolean} Whether the item is in the array.
 */
function arrayContains(array, item) {
  return array.indexOf(item) != -1;
}

/**
 * @param {!goog.array.ArrayLike<!{locale: string, value: string}>}
 *     localizedStrings An array of strings with corresponding locales.
 * @param {string} locale Locale to look the string up for.
 * @return {string} A string for the requested {@code locale}. An empty string
 *     if there's no string for the specified locale found.
 */
function getStringForLocale(localizedStrings, locale) {
  locale = locale.toLowerCase();
  for (var i = 0; i < localizedStrings.length; i++) {
    if (localizedStrings[i].locale.toLowerCase() == locale)
      return localizedStrings[i].value;
  }
  return '';
}

/**
 * @param {!goog.array.ArrayLike<!{locale: string, value: string}>}
 *     localizedStrings An array of strings with corresponding locales.
 * @return {string} A string for the current locale. An empty string if there's
 *     no string for the current locale found.
 */
function getStringForCurrentLocale(localizedStrings) {
  // First try to find an exact match and then look for the language only.
  return getStringForLocale(localizedStrings, navigator.language) ||
         getStringForLocale(localizedStrings,
                            navigator.language.split('-')[0]);
}

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Creates a PrintHeader object. This object encapsulates all the elements
   * and logic related to the top part of the left pane in print_preview.html.
   * @param {!print_preview.PrintTicketStore} printTicketStore Used to read
   *     information about the document.
   * @param {!print_preview.DestinationStore} destinationStore Used to get the
   *     selected destination.
   * @constructor
   * @extends {print_preview.Component}
   */
  function PrintHeader(printTicketStore, destinationStore) {
    print_preview.Component.call(this);

    /**
     * Used to read information about the document.
     * @type {!print_preview.PrintTicketStore}
     * @private
     */
    this.printTicketStore_ = printTicketStore;

    /**
     * Used to get the selected destination.
     * @type {!print_preview.DestinationStore}
     * @private
     */
    this.destinationStore_ = destinationStore;

    /**
     * Whether the component is enabled.
     * @type {boolean}
     * @private
     */
    this.isEnabled_ = true;

    /**
     * Whether the print button is enabled.
     * @type {boolean}
     * @private
     */
    this.isPrintButtonEnabled_ = true;
  };

  /**
   * Event types dispatched by the print header.
   * @enum {string}
   */
  PrintHeader.EventType = {
    PRINT_BUTTON_CLICK: 'print_preview.PrintHeader.PRINT_BUTTON_CLICK',
    CANCEL_BUTTON_CLICK: 'print_preview.PrintHeader.CANCEL_BUTTON_CLICK'
  };

  PrintHeader.prototype = {
    __proto__: print_preview.Component.prototype,

    set isEnabled(isEnabled) {
      this.isEnabled_ = isEnabled;
      this.updatePrintButtonEnabledState_();
      this.isCancelButtonEnabled = isEnabled;
    },

    get isPrintButtonEnabled() {
      return !this.getChildElement('button.print').disabled;
    },

    set isPrintButtonEnabled(isEnabled) {
      this.isPrintButtonEnabled_ = isEnabled;
      this.updatePrintButtonEnabledState_();
    },

    set isCancelButtonEnabled(isEnabled) {
      this.getChildElement('button.cancel').disabled = !isEnabled;
    },

    /** @param {string} message Error message to display in the print header. */
    setErrorMessage: function(message) {
      var summaryEl = this.getChildElement('.summary');
      summaryEl.innerHTML = '';
      summaryEl.textContent = message;
      this.getChildElement('button.print').classList.toggle('loading', false);
      this.getChildElement('button.cancel').classList.toggle('loading', false);
    },

    /** @override */
    decorateInternal: function() {
      cr.ui.reverseButtonStrips(this.getElement());
    },

    /** @override */
    enterDocument: function() {
      print_preview.Component.prototype.enterDocument.call(this);

      // User events
      this.tracker.add(
          this.getChildElement('button.cancel'),
          'click',
          this.onCancelButtonClick_.bind(this));
      this.tracker.add(
          this.getChildElement('button.print'),
          'click',
          this.onPrintButtonClick_.bind(this));

      // Data events.
      this.tracker.add(
          this.printTicketStore_,
          print_preview.PrintTicketStore.EventType.INITIALIZE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.printTicketStore_,
          print_preview.PrintTicketStore.EventType.DOCUMENT_CHANGE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.printTicketStore_,
          print_preview.PrintTicketStore.EventType.TICKET_CHANGE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.DESTINATION_SELECT,
          this.onDestinationSelect_.bind(this));
      this.tracker.add(
          this.printTicketStore_.copies,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.printTicketStore_.duplex,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.printTicketStore_.pageRange,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onTicketChange_.bind(this));
    },

    /**
     * Updates Print Button state.
     * @private
     */
    updatePrintButtonEnabledState_: function() {
      this.getChildElement('button.print').disabled =
          this.destinationStore_.selectedDestination == null ||
          !this.isEnabled_ ||
          !this.isPrintButtonEnabled_ ||
          !this.printTicketStore_.isTicketValid();
    },

    /**
     * Updates the summary element based on the currently selected user options.
     * @private
     */
    updateSummary_: function() {
      if (!this.printTicketStore_.isTicketValid()) {
        this.getChildElement('.summary').innerHTML = '';
        return;
      }

      var summaryLabel =
          loadTimeData.getString('printPreviewSheetsLabelSingular');
      var pagesLabel = loadTimeData.getString('printPreviewPageLabelPlural');

      var saveToPdfOrDrive = this.destinationStore_.selectedDestination &&
          (this.destinationStore_.selectedDestination.id ==
              print_preview.Destination.GooglePromotedId.SAVE_AS_PDF ||
           this.destinationStore_.selectedDestination.id ==
              print_preview.Destination.GooglePromotedId.DOCS);
      if (saveToPdfOrDrive) {
        summaryLabel = loadTimeData.getString('printPreviewPageLabelSingular');
      }

      var numPages = this.printTicketStore_.pageRange.getPageNumberSet().size;
      var numSheets = numPages;
      if (!saveToPdfOrDrive && this.printTicketStore_.duplex.getValue()) {
        numSheets = Math.ceil(numPages / 2);
      }

      var copies = this.printTicketStore_.copies.getValueAsNumber();
      numSheets *= copies;
      numPages *= copies;

      if (numSheets > 1) {
        summaryLabel = saveToPdfOrDrive ? pagesLabel :
            loadTimeData.getString('printPreviewSheetsLabelPlural');
      }

      var html;
      var label;
      if (numPages != numSheets) {
        html = loadTimeData.getStringF(
            'printPreviewSummaryFormatLong',
            '<b>' + numSheets.toLocaleString() + '</b>',
            '<b>' + summaryLabel + '</b>',
            numPages.toLocaleString(),
            pagesLabel);
        label = loadTimeData.getStringF('printPreviewSummaryFormatLong',
                                        numSheets.toLocaleString(),
                                        summaryLabel,
                                        numPages.toLocaleString(),
                                        pagesLabel);
      } else {
        html = loadTimeData.getStringF(
            'printPreviewSummaryFormatShort',
            '<b>' + numSheets.toLocaleString() + '</b>',
            '<b>' + summaryLabel + '</b>');
        label = loadTimeData.getStringF('printPreviewSummaryFormatShort',
                                        numSheets.toLocaleString(),
                                        summaryLabel);
      }

      // Removing extra spaces from within the string.
      html = html.replace(/\s{2,}/g, ' ');

      var summary = this.getChildElement('.summary');
      summary.innerHTML = html;
      summary.setAttribute('aria-label', label);
    },

    /**
     * Called when the print button is clicked. Dispatches a PRINT_DOCUMENT
     * common event.
     * @private
     */
    onPrintButtonClick_: function() {
      if (this.destinationStore_.selectedDestination.id !=
          print_preview.Destination.GooglePromotedId.SAVE_AS_PDF) {
        this.getChildElement('button.print').classList.add('loading');
        this.getChildElement('button.cancel').classList.add('loading');
        var isSaveLabel = (this.destinationStore_.selectedDestination.id ==
             print_preview.Destination.GooglePromotedId.DOCS);
        this.getChildElement('.summary').innerHTML =
            loadTimeData.getString(isSaveLabel ? 'saving' : 'printing');
      }
      cr.dispatchSimpleEvent(this, PrintHeader.EventType.PRINT_BUTTON_CLICK);
    },

    /**
     * Called when the cancel button is clicked. Dispatches a
     * CLOSE_PRINT_PREVIEW event.
     * @private
     */
    onCancelButtonClick_: function() {
      cr.dispatchSimpleEvent(this, PrintHeader.EventType.CANCEL_BUTTON_CLICK);
    },

    /**
     * Called when a new destination is selected. Updates the text on the print
     * button.
     * @private
     */
    onDestinationSelect_: function() {
      var isSaveLabel = this.destinationStore_.selectedDestination &&
          (this.destinationStore_.selectedDestination.id ==
               print_preview.Destination.GooglePromotedId.SAVE_AS_PDF ||
           this.destinationStore_.selectedDestination.id ==
               print_preview.Destination.GooglePromotedId.DOCS);
      this.getChildElement('button.print').textContent =
          loadTimeData.getString(isSaveLabel ? 'saveButton' : 'printButton');
      if (this.destinationStore_.selectedDestination) {
        this.getChildElement('button.print').focus();
      }
    },

    /**
     * Called when the print ticket has changed. Disables the print button if
     * any of the settings are invalid.
     * @private
     */
    onTicketChange_: function() {
      this.updatePrintButtonEnabledState_();
      this.updateSummary_();
      if (document.activeElement == null ||
          document.activeElement == document.body) {
        this.getChildElement('button.print').focus();
      }
    }
  };

  // Export
  return {
    PrintHeader: PrintHeader
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Object used to measure usage statistics.
   * @constructor
   */
  function Metrics() {};

  /**
   * Enumeration of buckets that a user can enter while using the destination
   * search widget.
   * @enum {number}
   */
  Metrics.DestinationSearchBucket = {
    // Used when the print destination search widget is shown.
    DESTINATION_SHOWN: 0,
    // Used when the user selects a print destination.
    DESTINATION_CLOSED_CHANGED: 1,
    // Used when the print destination search widget is closed without selecting
    // a print destination.
    DESTINATION_CLOSED_UNCHANGED: 2,
    // Used when the Google Cloud Print promotion (shown in the destination
    // search widget) is shown to the user.
    SIGNIN_PROMPT: 3,
    // Used when the user chooses to sign-in to their Google account.
    SIGNIN_TRIGGERED: 4,
    // Used when a user selects the Privet printer in a pair of duplicate
    // Privet and cloud printers.
    PRIVET_DUPLICATE_SELECTED: 5,
    // Used when a user selects the cloud printer in a pair of duplicate
    // Privet and cloud printers.
    CLOUD_DUPLICATE_SELECTED: 6,
    // Used when a user sees a register promo for a cloud print printer.
    REGISTER_PROMO_SHOWN: 7,
    // Used when a user selects a register promo for a cloud print printer.
    REGISTER_PROMO_SELECTED: 8,
    // User changed active account.
    ACCOUNT_CHANGED: 9,
    // User tried to log into another account.
    ADD_ACCOUNT_SELECTED: 10,
    // Printer sharing invitation was shown to the user.
    INVITATION_AVAILABLE: 11,
    // User accepted printer sharing invitation.
    INVITATION_ACCEPTED: 12,
    // User rejected printer sharing invitation.
    INVITATION_REJECTED: 13,
    // Max value.
    DESTINATION_SEARCH_MAX_BUCKET: 14
  };

  /**
   * Enumeration of buckets that a user can enter while using the Google Cloud
   * Print promotion.
   * @enum {number}
   */
  Metrics.GcpPromoBucket = {
    // Used when the Google Cloud Print promotion (shown above the PDF preview
    // plugin) is shown to the user.
    PROMO_SHOWN: 0,
    // Used when the user clicks the "Get started" link in the promotion shown
    // in CLOUDPRINT_BIG_PROMO_SHOWN.
    PROMO_CLICKED: 1,
    // Used when the user dismisses the promotion shown in
    // CLOUDPRINT_BIG_PROMO_SHOWN.
    PROMO_CLOSED: 2,
    // Max value.
    GCP_PROMO_MAX_BUCKET: 3
  };

  /**
   * Print settings UI usage metrics buckets.
   * @enum {number}
   */
  Metrics.PrintSettingsUiBucket = {
    // Advanced settings dialog is shown.
    ADVANCED_SETTINGS_DIALOG_SHOWN: 0,
    // Advanced settings dialog is closed without saving a selection.
    ADVANCED_SETTINGS_DIALOG_CANCELED: 1,
    // 'More/less settings' expanded.
    MORE_SETTINGS_CLICKED: 2,
    // 'More/less settings' collapsed.
    LESS_SETTINGS_CLICKED: 3,
    // User printed with extra settings expanded.
    PRINT_WITH_SETTINGS_EXPANDED: 4,
    // User printed with extra settings collapsed.
    PRINT_WITH_SETTINGS_COLLAPSED: 5,
    // Max value.
    PRINT_SETTINGS_UI_MAX_BUCKET: 6
  };

  /**
   * A context for recording a value in a specific UMA histogram.
   * @param {string} histogram The name of the histogram to be recorded in.
   * @param {number} maxBucket The max value for the last histogram bucket.
   * @constructor
   */
  function MetricsContext(histogram, maxBucket) {
    /** @private {string} */
    this.histogram_ = histogram;

    /** @private {number} */
    this.maxBucket_ = maxBucket;
  };

  MetricsContext.prototype = {
    /**
     * Record a histogram value in UMA. If specified value is larger than the
     * max bucket value, record the value in the largest bucket
     * @param {number} bucket Value to record.
     */
    record: function(bucket) {
      chrome.send('metricsHandler:recordInHistogram',
                  [this.histogram_,
                   ((bucket > this.maxBucket_) ? this.maxBucket_ : bucket),
                   this.maxBucket_]);
    }
  };

  /**
   * Destination Search specific usage statistics context.
   * @constructor
   * @extends {print_preview.MetricsContext}
   */
  function DestinationSearchMetricsContext() {
    MetricsContext.call(
        this,
        'PrintPreview.DestinationAction',
        Metrics.DestinationSearchBucket.DESTINATION_SEARCH_MAX_BUCKET);
  };

  DestinationSearchMetricsContext.prototype = {
    __proto__: MetricsContext.prototype
  };

  /**
   * GCP promotion specific usage statistics context.
   * @constructor
   * @extends {print_preview.MetricsContext}
   */
  function GcpPromoMetricsContext() {
    MetricsContext.call(this,
                        'PrintPreview.GcpPromo',
                        Metrics.GcpPromoBucket.GCP_PROMO_MAX_BUCKET);
  };

  GcpPromoMetricsContext.prototype = {
    __proto__: MetricsContext.prototype
  };

  /**
   * Print settings UI specific usage statistics context.
   * @constructor
   * @extends {print_preview.MetricsContext}
   */
  function PrintSettingsUiMetricsContext() {
    MetricsContext.call(
        this,
        'PrintPreview.PrintSettingsUi',
        Metrics.PrintSettingsUiBucket.PRINT_SETTINGS_UI_MAX_BUCKET);
  };

  PrintSettingsUiMetricsContext.prototype = {
    __proto__: MetricsContext.prototype
  };

  // Export
  return {
    Metrics: Metrics,
    MetricsContext: MetricsContext,
    DestinationSearchMetricsContext: DestinationSearchMetricsContext,
    GcpPromoMetricsContext: GcpPromoMetricsContext,
    PrintSettingsUiMetricsContext: PrintSettingsUiMetricsContext
  };
});


// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Base class for print option section components.
   * @constructor
   * @extends {print_preview.Component}
   */
  function SettingsSection() {
    print_preview.Component.call(this);

    /**
     * Cached "hasCollapsibleContent" status for COLLAPSIBLE_CONTENT_CHANGED
     * notification.
     * @private {?boolean}
     */
    this.hasCollapsibleContentCached_ = null;

    /**
     * Whether content of this section should be collapsed or not.
     * @private {boolean}
     */
    this.collapseContent_ = true;
  };

  /**
   * Event types dispatched by this class.
   * @enum {string}
   */
  SettingsSection.EventType = {
    COLLAPSIBLE_CONTENT_CHANGED:
        'print_preview.SettingsSection.COLLAPSIBLE_CONTENT_CHANGED'
  };

  SettingsSection.prototype = {
    __proto__: print_preview.Component.prototype,

    /** @return {boolean} Whether this section should be displayed or not. */
    isAvailable: function() {
      throw Error('Abstract method not overridden');
    },

    /**
     * @return {boolean} Whether this section has a content which can be
     *     collapsed/expanded.
     */
    hasCollapsibleContent: function() {
      throw Error('Abstract method not overridden');
    },

    /** @param {boolean} isEnabled Whether this component is enabled. */
    set isEnabled(isEnabled) {
      throw Error('Abstract method not overridden');
    },

    /**
     * @return {boolean} Whether the content of this section should be
     *     collapsed.
     */
    get collapseContent() {
      return this.collapseContent_;
    },

    /**
     * @param {boolean} collapseContent Whether the content of this section
     *     should be collapsed, even if this section is available.
     * @param {boolean} noAnimation Whether section visibility transition
     *     should not be animated.
     */
    setCollapseContent: function(collapseContent, noAnimation) {
      this.collapseContent_ = collapseContent && this.hasCollapsibleContent();
      this.updateUiStateInternal(noAnimation);
    },

    /** @override */
    enterDocument: function() {
      print_preview.Component.prototype.enterDocument.call(this);
      this.isAvailable_ = this.isAvailable();
      if (!this.isAvailable())
        fadeOutOption(this.getElement(), true);
    },

    /**
     * Updates the component appearance according to the current state.
     * @param {boolean=} opt_noAnimation Whether section visibility transition
     *     should not be animated.
     * @protected
     */
    updateUiStateInternal: function(opt_noAnimation) {
      var hasCollapsibleContent = this.hasCollapsibleContent();
      var changed = this.hasCollapsibleContentCached_ != hasCollapsibleContent;
      this.hasCollapsibleContentCached_ = hasCollapsibleContent;

      if (this.isSectionVisibleInternal())
        fadeInOption(this.getElement(), opt_noAnimation);
      else
        fadeOutOption(this.getElement(), opt_noAnimation);

      if (changed) {
        cr.dispatchSimpleEvent(
            this, SettingsSection.EventType.COLLAPSIBLE_CONTENT_CHANGED);
      }
    },

    /**
     * @return {boolean} Whether this section should be displayed or not.
     * @protected
     */
    isSectionVisibleInternal: function() {
      return this.isAvailable() && !this.collapseContent_;
    }
  };

  // Export
  return {
    SettingsSection: SettingsSection
  };
});

// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Base class for the printer option element visualizing the generic selection
   * based option.
   * @param {!print_preview.ticket_items.TicketItem} ticketItem Ticket item
   *     visualized by this component.
   * @constructor
   * @extends {print_preview.SettingsSection}
   */
  function SettingsSectionSelect(ticketItem) {
    print_preview.SettingsSection.call(this);

    /** @private {!print_preview.ticket_items.TicketItem} */
    this.ticketItem_ = ticketItem;
  };

  SettingsSectionSelect.prototype = {
    __proto__: print_preview.SettingsSection.prototype,

    /** @override */
    isAvailable: function() {
      return this.ticketItem_.isCapabilityAvailable();
    },

    /** @override */
    hasCollapsibleContent: function() {
      return this.isAvailable();
    },

    /** @override */
    set isEnabled(isEnabled) {
      this.select_.disabled = !isEnabled;
    },

    /** @override */
    enterDocument: function() {
      print_preview.SettingsSection.prototype.enterDocument.call(this);
      this.tracker.add(assert(this.select_),
                       'change',
                       this.onSelectChange_.bind(this));
      this.tracker.add(this.ticketItem_,
                       print_preview.ticket_items.TicketItem.EventType.CHANGE,
                       this.onTicketItemChange_.bind(this));
    },

    /**
     * @return {HTMLSelectElement} Select element containing option items.
     * @private
     */
    get select_() {
      return this.getElement().querySelector('.settings-select');
    },

    /**
     * Makes sure the content of the select element matches the capabilities of
     * the destination.
     * @private
     */
    updateSelect_: function() {
      var select = this.select_;
      if (!this.isAvailable()) {
        select.innerHTML = '';
        return;
      }
      // Should the select content be updated?
      var sameContent =
          this.ticketItem_.capability.option.length == select.length &&
          this.ticketItem_.capability.option.every(function(option, index) {
            return select.options[index].value == JSON.stringify(option);
          });
      var indexToSelect = select.selectedIndex;
      if (!sameContent) {
        select.innerHTML = '';
        this.ticketItem_.capability.option.forEach(function(option, index) {
          var selectOption = document.createElement('option');
          selectOption.text = this.getCustomDisplayName_(option) ||
                              this.getDefaultDisplayName_(option);
          selectOption.value = JSON.stringify(option);
          select.appendChild(selectOption);
          if (option.is_default)
            indexToSelect = index;
        }, this);
      }
      // Try to select current ticket item.
      var valueToSelect = JSON.stringify(this.ticketItem_.getValue());
      for (var i = 0, option; option = select.options[i]; i++) {
        if (option.value == valueToSelect) {
          indexToSelect = i;
          break;
        }
      }
      select.selectedIndex = indexToSelect;
      this.onSelectChange_();
    },

    /**
     * @param {!Object} option Option to get the custom display name for.
     * @return {string} Custom display name for the option.
     * @private
     */
    getCustomDisplayName_: function(option) {
      var displayName = option.custom_display_name;
      if (!displayName && option.custom_display_name_localized) {
        displayName =
            getStringForCurrentLocale(option.custom_display_name_localized);
      }
      return displayName;
    },

    /**
     * @param {!Object} option Option to get the default display name for.
     * @return {string} Default option display name.
     * @private
     */
    getDefaultDisplayName_: function(option) {
      throw Error('Abstract method not overridden');
    },

    /**
     * Called when the select element is changed. Updates the print ticket.
     * @private
     */
    onSelectChange_: function() {
      var select = this.select_;
      this.ticketItem_.updateValue(
          JSON.parse(select.options[select.selectedIndex].value));
    },

    /**
     * Called when the print ticket store changes. Selects the corresponding
     * select option.
     * @private
     */
    onTicketItemChange_: function() {
      this.updateSelect_();
      this.updateUiStateInternal();
    }
  };

  // Export
  return {
    SettingsSectionSelect: SettingsSectionSelect
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Creates a PageSettings object. This object encapsulates all settings and
   * logic related to page selection.
   * @param {!print_preview.ticket_items.PageRange} pageRangeTicketItem Used to
   *     read and write page range settings.
   * @constructor
   * @extends {print_preview.SettingsSection}
   */
  function PageSettings(pageRangeTicketItem) {
    print_preview.SettingsSection.call(this);

    /**
     * Used to read and write page range settings.
     * @type {!print_preview.ticket_items.PageRange}
     * @private
     */
    this.pageRangeTicketItem_ = pageRangeTicketItem;

    /**
     * Timeout used to delay processing of the custom page range input.
     * @type {?number}
     * @private
     */
    this.customInputTimeout_ = null;

    /**
     * Custom page range input.
     * @type {HTMLInputElement}
     * @private
     */
    this.customInput_ = null;

    /**
     * Custom page range radio button.
     * @type {HTMLInputElement}
     * @private
     */
    this.customRadio_ = null;

    /**
     * All page rage radio button.
     * @type {HTMLInputElement}
     * @private
     */
    this.allRadio_ = null;

    /**
     * Container of a hint to show when the custom page range is invalid.
     * @type {HTMLElement}
     * @private
     */
    this.customHintEl_ = null;
  };

  /**
   * CSS classes used by the page settings.
   * @enum {string}
   * @private
   */
  PageSettings.Classes_ = {
    ALL_RADIO: 'page-settings-all-radio',
    CUSTOM_HINT: 'page-settings-custom-hint',
    CUSTOM_INPUT: 'page-settings-custom-input',
    CUSTOM_RADIO: 'page-settings-custom-radio'
  };

  /**
   * Delay in milliseconds before processing custom page range input.
   * @type {number}
   * @private
   */
  PageSettings.CUSTOM_INPUT_DELAY_ = 500;

  PageSettings.prototype = {
    __proto__: print_preview.SettingsSection.prototype,

    /** @override */
    isAvailable: function() {
      return this.pageRangeTicketItem_.isCapabilityAvailable();
    },

    /** @override */
    hasCollapsibleContent: function() {
      return false;
    },

    /** @override */
    set isEnabled(isEnabled) {
      this.customInput_.disabled = !isEnabled;
      this.allRadio_.disabled = !isEnabled;
      this.customRadio_.disabled = !isEnabled;
    },

    /** @override */
    enterDocument: function() {
      print_preview.SettingsSection.prototype.enterDocument.call(this);
      this.tracker.add(
          this.allRadio_, 'click', this.onAllRadioClick_.bind(this));
      this.tracker.add(
          this.customRadio_, 'click', this.onCustomRadioClick_.bind(this));
      this.tracker.add(
          this.customInput_, 'blur', this.onCustomInputBlur_.bind(this));
      this.tracker.add(
          this.customInput_, 'focus', this.onCustomInputFocus_.bind(this));
      this.tracker.add(
          this.customInput_, 'keydown', this.onCustomInputKeyDown_.bind(this));
      this.tracker.add(
          this.customInput_, 'input', this.onCustomInputChange_.bind(this));
      this.tracker.add(
          this.pageRangeTicketItem_,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onPageRangeTicketItemChange_.bind(this));
    },

    /** @override */
    exitDocument: function() {
      print_preview.SettingsSection.prototype.exitDocument.call(this);
      this.customInput_ = null;
      this.customRadio_ = null;
      this.allRadio_ = null;
      this.customHintEl_ = null;
    },

    /** @override */
    decorateInternal: function() {
      this.customInput_ = this.getElement().getElementsByClassName(
          PageSettings.Classes_.CUSTOM_INPUT)[0];
      this.allRadio_ = this.getElement().getElementsByClassName(
          PageSettings.Classes_.ALL_RADIO)[0];
      this.customRadio_ = this.getElement().getElementsByClassName(
          PageSettings.Classes_.CUSTOM_RADIO)[0];
      this.customHintEl_ = this.getElement().getElementsByClassName(
          PageSettings.Classes_.CUSTOM_HINT)[0];
    },

    /**
     * @param {!PageRangeStatus} validity (of page range)
     * @private
     */
    setInvalidStateVisible_: function(validity) {
      if (validity !== PageRangeStatus.NO_ERROR) {
        var message;
        if (validity === PageRangeStatus.LIMIT_ERROR) {
          if (this.pageRangeTicketItem_.getDocumentNumPages()) {
            message = loadTimeData.getStringF(
                'pageRangeLimitInstructionWithValue',
                this.pageRangeTicketItem_.getDocumentNumPages());
          } else {
            message = loadTimeData.getString(
                'pageRangeLimitInstruction');
          }
        } else {
          message = loadTimeData.getStringF(
              'pageRangeSyntaxInstruction',
              loadTimeData.getString('examplePageRangeText'));
        }
        this.customHintEl_.textContent = message;
        this.customInput_.classList.add('invalid');
        fadeInElement(this.customHintEl_);
      } else {
        this.customInput_.classList.remove('invalid');
        fadeOutElement(this.customHintEl_);
      }
    },

    /**
     * Called when the all radio button is clicked. Updates the print ticket.
     * @private
     */
    onAllRadioClick_: function() {
      this.pageRangeTicketItem_.updateValue(null);
    },

    /**
     * Called when the custom radio button is clicked. Updates the print ticket.
     * @private
     */
    onCustomRadioClick_: function() {
      this.customInput_.focus();
    },

    /**
     * Called when the custom input is blurred. Enables the all radio button if
     * the custom input is empty.
     * @private
     */
    onCustomInputBlur_: function(event) {
      if (this.customInput_.value == '' &&
          event.relatedTarget != this.customRadio_) {
        this.allRadio_.checked = true;
      }
    },

    /**
     * Called when the custom input is focused.
     * @private
     */
    onCustomInputFocus_: function() {
      this.customRadio_.checked = true;
      this.pageRangeTicketItem_.updateValue(this.customInput_.value);
    },

    /**
     * Called when a key is pressed on the custom input.
     * @param {Event} event Contains the key that was pressed.
     * @private
     */
    onCustomInputKeyDown_: function(event) {
      if (event.keyCode == 13 /*enter*/) {
        if (this.customInputTimeout_) {
          clearTimeout(this.customInputTimeout_);
          this.customInputTimeout_ = null;
        }
        this.pageRangeTicketItem_.updateValue(this.customInput_.value);
      }
    },

    /**
     * Called after a delay following a key press in the custom input.
     * @private
     */
    onCustomInputTimeout_: function() {
      this.customInputTimeout_ = null;
      if (this.customRadio_.checked) {
        this.pageRangeTicketItem_.updateValue(this.customInput_.value);
      }
    },

    /**
     * Called for events that change the text - undo, redo, paste and
     * keystrokes outside of enter, copy, etc. (Re)starts the
     * re-evaluation timer.
     * @private
     */
    onCustomInputChange_: function() {
      if (this.customInputTimeout_)
        clearTimeout(this.customInputTimeout_);
      this.customInputTimeout_ = setTimeout(
          this.onCustomInputTimeout_.bind(this),
          PageSettings.CUSTOM_INPUT_DELAY_);
    },

    /**
     * Called when the print ticket changes. Updates the state of the component.
     * @private
     */
    onPageRangeTicketItemChange_: function() {
      if (this.isAvailable()) {
        var pageRangeStr = this.pageRangeTicketItem_.getValue();
        if (pageRangeStr || this.customRadio_.checked) {
          if (!document.hasFocus() ||
              document.activeElement != this.customInput_) {
            this.customInput_.value = pageRangeStr;
          }
          this.customRadio_.checked = true;
          this.setInvalidStateVisible_(
              this.pageRangeTicketItem_.checkValidity());
        } else {
          this.allRadio_.checked = true;
          this.setInvalidStateVisible_(PageRangeStatus.NO_ERROR);
        }
      }
      this.updateUiStateInternal();
    }
  };

  // Export
  return {
    PageSettings: PageSettings
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Component that renders the copies settings UI.
   * @param {!print_preview.ticket_items.Copies} copiesTicketItem Used to read
   *     and write the copies value.
   * @param {!print_preview.ticket_items.Collate} collateTicketItem Used to read
   *     and write the collate value.
   * @constructor
   * @extends {print_preview.SettingsSection}
   */
  function CopiesSettings(copiesTicketItem, collateTicketItem) {
    print_preview.SettingsSection.call(this);

    /**
     * Used to read and write the copies value.
     * @type {!print_preview.ticket_items.Copies}
     * @private
     */
    this.copiesTicketItem_ = copiesTicketItem;

    /**
     * Used to read and write the collate value.
     * @type {!print_preview.ticket_items.Collate}
     * @private
     */
    this.collateTicketItem_ = collateTicketItem;

    /**
     * Timeout used to delay processing of the copies input.
     * @type {?number}
     * @private
     */
    this.textfieldTimeout_ = null;

    /**
     * Whether this component is enabled or not.
     * @type {boolean}
     * @private
     */
    this.isEnabled_ = true;
  };

  /**
   * Delay in milliseconds before processing the textfield.
   * @type {number}
   * @private
   */
  CopiesSettings.TEXTFIELD_DELAY_ = 250;

  CopiesSettings.prototype = {
    __proto__: print_preview.SettingsSection.prototype,

    /** @override */
    isAvailable: function() {
      return this.copiesTicketItem_.isCapabilityAvailable();
    },

    /** @override */
    hasCollapsibleContent: function() {
      return false;
    },

    /** @override */
    set isEnabled(isEnabled) {
      this.getChildElement('input.copies').disabled = !isEnabled;
      this.getChildElement('input.collate').disabled = !isEnabled;
      this.isEnabled_ = isEnabled;
      if (isEnabled) {
        this.updateState_();
      } else {
        this.getChildElement('button.increment').disabled = true;
        this.getChildElement('button.decrement').disabled = true;
      }
    },

    /** @override */
    enterDocument: function() {
      print_preview.SettingsSection.prototype.enterDocument.call(this);
      this.tracker.add(
          this.getChildElement('input.copies'),
          'keydown',
          this.onTextfieldKeyDown_.bind(this));
      this.tracker.add(
          this.getChildElement('input.copies'),
          'input',
          this.onTextfieldInput_.bind(this));
      this.tracker.add(
          this.getChildElement('input.copies'),
          'blur',
          this.onTextfieldBlur_.bind(this));
      this.tracker.add(
          this.getChildElement('button.increment'),
          'click',
          this.onButtonClicked_.bind(this, 1));
      this.tracker.add(
          this.getChildElement('button.decrement'),
          'click',
          this.onButtonClicked_.bind(this, -1));
      this.tracker.add(
          this.getChildElement('input.collate'),
          'click',
          this.onCollateCheckboxClick_.bind(this));
      this.tracker.add(
          this.copiesTicketItem_,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.updateState_.bind(this));
      this.tracker.add(
          this.collateTicketItem_,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.updateState_.bind(this));
    },

    /**
     * Updates the state of the copies settings UI controls.
     * @private
     */
    updateState_: function() {
      if (this.isAvailable()) {
        if (this.getChildElement('input.copies').value !=
            this.copiesTicketItem_.getValue()) {
          this.getChildElement('input.copies').value =
              this.copiesTicketItem_.getValue();
        }

        var currentValueGreaterThan1 = false;
        if (this.copiesTicketItem_.isValid()) {
          this.getChildElement('input.copies').classList.remove('invalid');
          fadeOutElement(this.getChildElement('.hint'));
          var currentValue = this.copiesTicketItem_.getValueAsNumber();
          var currentValueGreaterThan1 = currentValue > 1;
          this.getChildElement('button.increment').disabled =
              !this.isEnabled_ ||
              !this.copiesTicketItem_.wouldValueBeValid(currentValue + 1);
          this.getChildElement('button.decrement').disabled =
              !this.isEnabled_ ||
              !this.copiesTicketItem_.wouldValueBeValid(currentValue - 1);
        } else {
          this.getChildElement('input.copies').classList.add('invalid');
          fadeInElement(this.getChildElement('.hint'));
          this.getChildElement('button.increment').disabled = true;
          this.getChildElement('button.decrement').disabled = true;
        }

        if (!(this.getChildElement('.collate-container').hidden =
               !this.collateTicketItem_.isCapabilityAvailable() ||
               !currentValueGreaterThan1)) {
          this.getChildElement('input.collate').checked =
              this.collateTicketItem_.getValue();
        }
      }
      this.updateUiStateInternal();
    },

    /**
     * Called whenever the increment/decrement buttons are clicked.
     * @param {number} delta Must be 1 for an increment button click and -1 for
     *     a decrement button click.
     * @private
     */
    onButtonClicked_: function(delta) {
      // Assumes text field has a valid number.
      var newValue =
          parseInt(this.getChildElement('input.copies').value, 10) + delta;
      this.copiesTicketItem_.updateValue(newValue + '');
    },

    /**
     * Called after a timeout after user input into the textfield.
     * @private
     */
    onTextfieldTimeout_: function() {
      this.textfieldTimeout_ = null;
      var copiesVal = this.getChildElement('input.copies').value;
      if (copiesVal != '') {
        this.copiesTicketItem_.updateValue(copiesVal);
      }
    },

    /**
     * Called when a key is pressed on the custom input.
     * @param {Event} event Contains the key that was pressed.
     * @private
     */
    onTextfieldKeyDown_: function(event) {
      if (event.keyCode == 13 /*enter*/) {
        if (this.textfieldTimeout_) {
          clearTimeout(this.textfieldTimeout_);
        }
        this.onTextfieldTimeout_();
      }
    },

    /**
     * Called when a input event occurs on the textfield. Starts an input
     * timeout.
     * @private
     */
    onTextfieldInput_: function() {
      if (this.textfieldTimeout_) {
        clearTimeout(this.textfieldTimeout_);
      }
      this.textfieldTimeout_ = setTimeout(
          this.onTextfieldTimeout_.bind(this), CopiesSettings.TEXTFIELD_DELAY_);
    },

    /**
     * Called when the focus leaves the textfield. If the textfield is empty,
     * its value is set to 1.
     * @private
     */
    onTextfieldBlur_: function() {
      if (this.getChildElement('input.copies').value == '') {
        // Do it asynchronously to avoid moving focus to Print button in
        // PrintHeader.onTicketChange_.
        setTimeout((function() {
          this.copiesTicketItem_.updateValue('1');
        }).bind(this), 0);
      }
    },

    /**
     * Called when the collate checkbox is clicked. Updates the print ticket.
     * @private
     */
    onCollateCheckboxClick_: function() {
      this.collateTicketItem_.updateValue(
          this.getChildElement('input.collate').checked);
    }
  };

  // Export
  return {
    CopiesSettings: CopiesSettings
  };
});

// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Encapsulates all settings and logic related to the DPI selection UI.
   * @param {!print_preview.ticket_items.Dpi} ticketItem Used to read and write
   *     the DPI ticket item.
   * @constructor
   * @extends {print_preview.SettingsSectionSelect}
   */
  function DpiSettings(ticketItem) {
    print_preview.SettingsSectionSelect.call(this, ticketItem);
  };

  DpiSettings.prototype = {
    __proto__: print_preview.SettingsSectionSelect.prototype,

    /** @override */
    getDefaultDisplayName_: function(option) {
      var hDpi = option.horizontal_dpi || 0;
      var vDpi = option.vertical_dpi || 0;
      if (hDpi > 0 && vDpi > 0 && hDpi != vDpi) {
        return loadTimeData.getStringF('nonIsotropicDpiItemLabel',
                                       hDpi.toLocaleString(),
                                       vDpi.toLocaleString());
      }
      return loadTimeData.getStringF('dpiItemLabel',
                                     (hDpi || vDpi).toLocaleString());
    }
  };

  // Export
  return {
    DpiSettings: DpiSettings
  };
});

// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Encapsulates all settings and logic related to the media size selection UI.
   * @param {!print_preview.ticket_items.MediaSize} ticketItem Used to read and
   *     write the media size ticket item.
   * @constructor
   * @extends {print_preview.SettingsSectionSelect}
   */
  function MediaSizeSettings(ticketItem) {
    print_preview.SettingsSectionSelect.call(this, ticketItem);
  };

  MediaSizeSettings.prototype = {
    __proto__: print_preview.SettingsSectionSelect.prototype,

    /** @override */
    getDefaultDisplayName_: function(option) {
      return option.name;
    }
  };

  // Export
  return {
    MediaSizeSettings: MediaSizeSettings
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Creates a LayoutSettings object. This object encapsulates all settings and
   * logic related to layout mode (portrait/landscape).
   * @param {!print_preview.ticket_items.Landscape} landscapeTicketItem Used to
   *     get the layout written to the print ticket.
   * @constructor
   * @extends {print_preview.SettingsSection}
   */
  function LayoutSettings(landscapeTicketItem) {
    print_preview.SettingsSection.call(this);

    /**
     * Used to get the layout written to the print ticket.
     * @type {!print_preview.ticket_items.Landscape}
     * @private
     */
    this.landscapeTicketItem_ = landscapeTicketItem;
  };

  LayoutSettings.prototype = {
    __proto__: print_preview.SettingsSection.prototype,

    /** @override */
    isAvailable: function() {
      return this.landscapeTicketItem_.isCapabilityAvailable();
    },

    /** @override */
    hasCollapsibleContent: function() {
      return false;
    },

    /** @override */
    set isEnabled(isEnabled) {
      this.select_.disabled = !isEnabled;
    },

    /** @override */
    enterDocument: function() {
      print_preview.SettingsSection.prototype.enterDocument.call(this);
      this.tracker.add(
          this.select_, 'change', this.onSelectChange_.bind(this));
      this.tracker.add(
          this.landscapeTicketItem_,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onLandscapeTicketItemChange_.bind(this));
    },

    /**
     * Called when the select element is changed. Updates the print ticket
     * layout selection.
     * @private
     */
    onSelectChange_: function() {
      var select = this.select_;
      var isLandscape =
          select.options[select.selectedIndex].value == 'landscape';
      this.landscapeTicketItem_.updateValue(isLandscape);
    },

    /**
     * @return {HTMLSelectElement} Select element containing the layout options.
     * @private
     */
    get select_() {
      return this.getChildElement('.layout-settings-select');
    },

    /**
     * Called when the print ticket store changes state. Updates the state of
     * the radio buttons and hides the setting if necessary.
     * @private
     */
    onLandscapeTicketItemChange_: function() {
      if (this.isAvailable()) {
        var select = this.select_;
        var valueToSelect =
            this.landscapeTicketItem_.getValue() ? 'landscape' : 'portrait';
        for (var i = 0; i < select.options.length; i++) {
          if (select.options[i].value == valueToSelect) {
            select.selectedIndex = i;
            break;
          }
        }
      }
      this.updateUiStateInternal();
    }
  };

  // Export
  return {
    LayoutSettings: LayoutSettings
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Creates a ColorSettings object. This object encapsulates all settings and
   * logic related to color selection (color/bw).
   * @param {!print_preview.ticket_item.Color} colorTicketItem Used for writing
   *     and reading color value.
   * @constructor
   * @extends {print_preview.SettingsSection}
   */
  function ColorSettings(colorTicketItem) {
    print_preview.SettingsSection.call(this);

    /**
     * Used for reading/writing the color value.
     * @type {!print_preview.ticket_items.Color}
     * @private
     */
    this.colorTicketItem_ = colorTicketItem;
  };

  ColorSettings.prototype = {
    __proto__: print_preview.SettingsSection.prototype,

    /** @override */
    isAvailable: function() {
      return this.colorTicketItem_.isCapabilityAvailable();
    },

    /** @override */
    hasCollapsibleContent: function() {
      return false;
    },

    /** @override */
    set isEnabled(isEnabled) {
      this.select_.disabled = !isEnabled;
    },

    /** @override */
    enterDocument: function() {
      print_preview.SettingsSection.prototype.enterDocument.call(this);
      this.tracker.add(
          this.select_, 'change', this.onSelectChange_.bind(this));
      this.tracker.add(
          this.colorTicketItem_,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.updateState_.bind(this));
    },

    /**
     * Called when the select element is changed. Updates the print ticket
     * color selection.
     * @private
     */
    onSelectChange_: function() {
      var select = this.select_;
      var isColor = select.options[select.selectedIndex].value == 'color';
      this.colorTicketItem_.updateValue(isColor);
    },

    /**
     * @return {HTMLSelectElement} Select element containing the color options.
     * @private
     */
    get select_() {
      return this.getChildElement('.color-settings-select');
    },

    /**
     * Updates state of the widget.
     * @private
     */
    updateState_: function() {
      if (this.isAvailable()) {
        var select = this.select_;
        var valueToSelect = this.colorTicketItem_.getValue() ? 'color' : 'bw';
        for (var i = 0; i < select.options.length; i++) {
          if (select.options[i].value == valueToSelect) {
            select.selectedIndex = i;
            break;
          }
        }
      }
      this.updateUiStateInternal();
    }
  };

  // Export
  return {
    ColorSettings: ColorSettings
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Creates a MarginSettings object. This object encapsulates all settings and
   * logic related to the margins mode.
   * @param {!print_preview.ticket_items.MarginsType} marginsTypeTicketItem Used
   *     to read and write the margins type ticket item.
   * @constructor
   * @extends {print_preview.SettingsSection}
   */
  function MarginSettings(marginsTypeTicketItem) {
    print_preview.SettingsSection.call(this);

    /**
     * Used to read and write the margins type ticket item.
     * @type {!print_preview.ticket_items.MarginsType}
     * @private
     */
    this.marginsTypeTicketItem_ = marginsTypeTicketItem;
  };

  /**
   * CSS classes used by the margin settings component.
   * @enum {string}
   * @private
   */
  MarginSettings.Classes_ = {
    SELECT: 'margin-settings-select'
  };

  MarginSettings.prototype = {
    __proto__: print_preview.SettingsSection.prototype,

    /** @override */
    isAvailable: function() {
      return this.marginsTypeTicketItem_.isCapabilityAvailable();
    },

    /** @override */
    hasCollapsibleContent: function() {
      return this.isAvailable();
    },

    /** @override */
    set isEnabled(isEnabled) {
      this.select_.disabled = !isEnabled;
    },

    /** @override */
    enterDocument: function() {
      print_preview.SettingsSection.prototype.enterDocument.call(this);
      this.tracker.add(
          this.select_, 'change', this.onSelectChange_.bind(this));
      this.tracker.add(
          this.marginsTypeTicketItem_,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onMarginsTypeTicketItemChange_.bind(this));
    },

    /**
     * @return {HTMLSelectElement} Select element containing the margin options.
     * @private
     */
    get select_() {
      return this.getElement().getElementsByClassName(
          MarginSettings.Classes_.SELECT)[0];
    },

    /**
     * Called when the select element is changed. Updates the print ticket
     * margin type.
     * @private
     */
    onSelectChange_: function() {
      var select = this.select_;
      var marginsType =
          /** @type {!print_preview.ticket_items.MarginsType.Value} */ (
              select.selectedIndex);
      this.marginsTypeTicketItem_.updateValue(marginsType);
    },

    /**
     * Called when the print ticket store changes. Selects the corresponding
     * select option.
     * @private
     */
    onMarginsTypeTicketItemChange_: function() {
      if (this.isAvailable()) {
        var select = this.select_;
        var marginsType = this.marginsTypeTicketItem_.getValue();
        var selectedMarginsType =
            /** @type {!print_preview.ticket_items.MarginsType.Value} */ (
                select.selectedIndex);
        if (marginsType != selectedMarginsType) {
          select.options[selectedMarginsType].selected = false;
          select.options[marginsType].selected = true;
        }
      }
      this.updateUiStateInternal();
    }
  };

  // Export
  return {
    MarginSettings: MarginSettings
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  // TODO(rltoscano): This class needs a throbber while loading the destination
  // or another solution is persist the settings of the printer so that next
  // load is fast.

  /**
   * Component used to render the print destination.
   * @param {!print_preview.DestinationStore} destinationStore Used to determine
   *     the selected destination.
   * @constructor
   * @extends {print_preview.SettingsSection}
   */
  function DestinationSettings(destinationStore) {
    print_preview.SettingsSection.call(this);

    /**
     * Used to determine the selected destination.
     * @type {!print_preview.DestinationStore}
     * @private
     */
    this.destinationStore_ = destinationStore;

    /**
     * Current CSS class of the destination icon.
     * @type {?DestinationSettings.Classes_}
     * @private
     */
    this.iconClass_ = null;
  };

  /**
   * Event types dispatched by the component.
   * @enum {string}
   */
  DestinationSettings.EventType = {
    CHANGE_BUTTON_ACTIVATE:
        'print_preview.DestinationSettings.CHANGE_BUTTON_ACTIVATE'
  };

  /**
   * CSS classes used by the component.
   * @enum {string}
   * @private
   */
  DestinationSettings.Classes_ = {
    CHANGE_BUTTON: 'destination-settings-change-button',
    ICON: 'destination-settings-icon',
    ICON_CLOUD: 'destination-settings-icon-cloud',
    ICON_CLOUD_SHARED: 'destination-settings-icon-cloud-shared',
    ICON_GOOGLE_PROMOTED: 'destination-settings-icon-google-promoted',
    ICON_LOCAL: 'destination-settings-icon-local',
    ICON_MOBILE: 'destination-settings-icon-mobile',
    ICON_MOBILE_SHARED: 'destination-settings-icon-mobile-shared',
    LOCATION: 'destination-settings-location',
    NAME: 'destination-settings-name',
    STALE: 'stale',
    THOBBER_NAME: 'destination-throbber-name'
  };

  DestinationSettings.prototype = {
    __proto__: print_preview.SettingsSection.prototype,

    /** @override */
    isAvailable: function() {
      return true;
    },

    /** @override */
    hasCollapsibleContent: function() {
      return false;
    },

    /** @override */
    set isEnabled(isEnabled) {
      var changeButton = this.getElement().getElementsByClassName(
          DestinationSettings.Classes_.CHANGE_BUTTON)[0];
      changeButton.disabled = !isEnabled;
    },

    /** @override */
    enterDocument: function() {
      print_preview.SettingsSection.prototype.enterDocument.call(this);
      var changeButton = this.getElement().getElementsByClassName(
          DestinationSettings.Classes_.CHANGE_BUTTON)[0];
      this.tracker.add(
          changeButton, 'click', this.onChangeButtonClick_.bind(this));
      this.tracker.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.DESTINATION_SELECT,
          this.onDestinationSelect_.bind(this));
      this.tracker_.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.
              CACHED_SELECTED_DESTINATION_INFO_READY,
          this.onSelectedDestinationNameSet_.bind(this));
    },

    /**
     * Called when the "Change" button is clicked. Dispatches the
     * CHANGE_BUTTON_ACTIVATE event.
     * @private
     */
    onChangeButtonClick_: function() {
      cr.dispatchSimpleEvent(
          this, DestinationSettings.EventType.CHANGE_BUTTON_ACTIVATE);
    },

    /**
     * Called when the destination selection has changed. Updates UI elements.
     * @private
     */
    onDestinationSelect_: function() {
      var destinationSettingsBoxEl =
          this.getChildElement('.destination-settings-box');

      var destination = this.destinationStore_.selectedDestination;
      if (destination != null) {
        var nameEl = this.getElement().getElementsByClassName(
            DestinationSettings.Classes_.NAME)[0];
        nameEl.textContent = destination.displayName;
        nameEl.title = destination.displayName;

        var iconEl = this.getElement().getElementsByClassName(
            DestinationSettings.Classes_.ICON)[0];
        iconEl.src = destination.iconUrl;

        var hint = destination.hint;
        var locationEl = this.getElement().getElementsByClassName(
            DestinationSettings.Classes_.LOCATION)[0];
        locationEl.textContent = hint;
        locationEl.title = hint;

        var offlineStatusText = destination.offlineStatusText;
        var offlineStatusEl =
            this.getChildElement('.destination-settings-offline-status');
        offlineStatusEl.textContent = offlineStatusText;
        offlineStatusEl.title = offlineStatusText;

        var isOffline = destination.isOffline;
        destinationSettingsBoxEl.classList.toggle(
            DestinationSettings.Classes_.STALE, isOffline);
        setIsVisible(locationEl, !isOffline);
        setIsVisible(offlineStatusEl, isOffline);
      }

      setIsVisible(
          this.getChildElement('.throbber-container'),
          this.destinationStore_.isAutoSelectDestinationInProgress);
      setIsVisible(destinationSettingsBoxEl, !!destination);
    },

    onSelectedDestinationNameSet_: function() {
      var destinationName =
          this.destinationStore_.selectedDestination.displayName;
      var nameEl = this.getElement().getElementsByClassName(
          DestinationSettings.Classes_.THOBBER_NAME)[0];
      nameEl.textContent = destinationName;
      nameEl.title = destinationName;
    }
  };

  // Export
  return {
    DestinationSettings: DestinationSettings
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * UI component that renders checkboxes for various print options.
   * @param {!print_preview.ticket_items.Duplex} duplex Duplex ticket item.
   * @param {!print_preview.ticket_items.FitToPage} fitToPage Fit-to-page ticket
   *     item.
   * @param {!print_preview.ticket_items.CssBackground} cssBackground CSS
   *     background ticket item.
   * @param {!print_preview.ticket_items.SelectionOnly} selectionOnly Selection
   *     only ticket item.
   * @param {!print_preview.ticket_items.HeaderFooter} headerFooter Header
   *     footer ticket item.
   * @constructor
   * @extends {print_preview.SettingsSection}
   */
  function OtherOptionsSettings(
      duplex, fitToPage, cssBackground, selectionOnly, headerFooter) {
    print_preview.SettingsSection.call(this);

    /**
     * Duplex ticket item, used to read/write the duplex selection.
     * @type {!print_preview.ticket_items.Duplex}
     * @private
     */
    this.duplexTicketItem_ = duplex;

    /**
     * Fit-to-page ticket item, used to read/write the fit-to-page selection.
     * @type {!print_preview.ticket_items.FitToPage}
     * @private
     */
    this.fitToPageTicketItem_ = fitToPage;

    /**
     * Enable CSS backgrounds ticket item, used to read/write.
     * @type {!print_preview.ticket_items.CssBackground}
     * @private
     */
    this.cssBackgroundTicketItem_ = cssBackground;

    /**
     * Print selection only ticket item, used to read/write.
     * @type {!print_preview.ticket_items.SelectionOnly}
     * @private
     */
    this.selectionOnlyTicketItem_ = selectionOnly;

    /**
     * Header-footer ticket item, used to read/write.
     * @type {!print_preview.ticket_items.HeaderFooter}
     * @private
     */
    this.headerFooterTicketItem_ = headerFooter;

     /**
     * Header footer container element.
     * @type {HTMLElement}
     * @private
     */
    this.headerFooterContainer_ = null;

    /**
     * Header footer checkbox.
     * @type {HTMLInputElement}
     * @private
     */
    this.headerFooterCheckbox_ = null;

    /**
     * Fit-to-page container element.
     * @type {HTMLElement}
     * @private
     */
    this.fitToPageContainer_ = null;

    /**
     * Fit-to-page checkbox.
     * @type {HTMLInputElement}
     * @private
     */
    this.fitToPageCheckbox_ = null;

    /**
     * Duplex container element.
     * @type {HTMLElement}
     * @private
     */
    this.duplexContainer_ = null;

    /**
     * Duplex checkbox.
     * @type {HTMLInputElement}
     * @private
     */
    this.duplexCheckbox_ = null;

    /**
     * Print CSS backgrounds container element.
     * @type {HTMLElement}
     * @private
     */
    this.cssBackgroundContainer_ = null;

    /**
     * Print CSS backgrounds checkbox.
     * @type {HTMLInputElement}
     * @private
     */
    this.cssBackgroundCheckbox_ = null;

    /**
     * Print selection only container element.
     * @type {HTMLElement}
     * @private
     */
    this.selectionOnlyContainer_ = null;

    /**
     * Print selection only checkbox.
     * @type {HTMLInputElement}
     * @private
     */
    this.selectionOnlyCheckbox_ = null;
  };

  OtherOptionsSettings.prototype = {
    __proto__: print_preview.SettingsSection.prototype,

    /** @override */
    isAvailable: function() {
      return this.headerFooterTicketItem_.isCapabilityAvailable() ||
             this.fitToPageTicketItem_.isCapabilityAvailable() ||
             this.duplexTicketItem_.isCapabilityAvailable() ||
             this.cssBackgroundTicketItem_.isCapabilityAvailable() ||
             this.selectionOnlyTicketItem_.isCapabilityAvailable();
    },

    /** @override */
    hasCollapsibleContent: function() {
      return this.headerFooterTicketItem_.isCapabilityAvailable() ||
             this.cssBackgroundTicketItem_.isCapabilityAvailable() ||
             this.selectionOnlyTicketItem_.isCapabilityAvailable();
    },

    /** @override */
    set isEnabled(isEnabled) {
      this.headerFooterCheckbox_.disabled = !isEnabled;
      this.fitToPageCheckbox_.disabled = !isEnabled;
      this.duplexCheckbox_.disabled = !isEnabled;
      this.cssBackgroundCheckbox_.disabled = !isEnabled;
    },

    /** @override */
    enterDocument: function() {
      print_preview.SettingsSection.prototype.enterDocument.call(this);
      this.tracker.add(
          this.headerFooterCheckbox_,
          'click',
          this.onHeaderFooterCheckboxClick_.bind(this));
      this.tracker.add(
          this.fitToPageCheckbox_,
          'click',
          this.onFitToPageCheckboxClick_.bind(this));
      this.tracker.add(
          this.duplexCheckbox_,
          'click',
          this.onDuplexCheckboxClick_.bind(this));
      this.tracker.add(
          this.cssBackgroundCheckbox_,
          'click',
          this.onCssBackgroundCheckboxClick_.bind(this));
      this.tracker.add(
          this.selectionOnlyCheckbox_,
          'click',
          this.onSelectionOnlyCheckboxClick_.bind(this));
      this.tracker.add(
          this.duplexTicketItem_,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onDuplexChange_.bind(this));
      this.tracker.add(
          this.fitToPageTicketItem_,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onFitToPageChange_.bind(this));
      this.tracker.add(
          this.cssBackgroundTicketItem_,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onCssBackgroundChange_.bind(this));
      this.tracker.add(
          this.selectionOnlyTicketItem_,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onSelectionOnlyChange_.bind(this));
      this.tracker.add(
          this.headerFooterTicketItem_,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onHeaderFooterChange_.bind(this));
    },

    /** @override */
    exitDocument: function() {
      print_preview.SettingsSection.prototype.exitDocument.call(this);
      this.headerFooterContainer_ = null;
      this.headerFooterCheckbox_ = null;
      this.fitToPageContainer_ = null;
      this.fitToPageCheckbox_ = null;
      this.duplexContainer_ = null;
      this.duplexCheckbox_ = null;
      this.cssBackgroundContainer_ = null;
      this.cssBackgroundCheckbox_ = null;
      this.selectionOnlyContainer_ = null;
      this.selectionOnlyCheckbox_ = null;
    },

    /** @override */
    decorateInternal: function() {
      this.headerFooterContainer_ = this.getElement().querySelector(
          '.header-footer-container');
      this.headerFooterCheckbox_ = this.headerFooterContainer_.querySelector(
          '.header-footer-checkbox');
      this.fitToPageContainer_ = this.getElement().querySelector(
          '.fit-to-page-container');
      this.fitToPageCheckbox_ = this.fitToPageContainer_.querySelector(
          '.fit-to-page-checkbox');
      this.duplexContainer_ = this.getElement().querySelector(
          '.duplex-container');
      this.duplexCheckbox_ = this.duplexContainer_.querySelector(
          '.duplex-checkbox');
      this.cssBackgroundContainer_ = this.getElement().querySelector(
          '.css-background-container');
      this.cssBackgroundCheckbox_ = this.cssBackgroundContainer_.querySelector(
          '.css-background-checkbox');
      this.selectionOnlyContainer_ = this.getElement().querySelector(
          '.selection-only-container');
      this.selectionOnlyCheckbox_ = this.selectionOnlyContainer_.querySelector(
          '.selection-only-checkbox');
    },

    /** @override */
    updateUiStateInternal: function() {
      if (this.isAvailable()) {
        setIsVisible(this.headerFooterContainer_,
                     this.headerFooterTicketItem_.isCapabilityAvailable() &&
                     !this.collapseContent);
        setIsVisible(this.fitToPageContainer_,
                     this.fitToPageTicketItem_.isCapabilityAvailable());
        setIsVisible(this.duplexContainer_,
                     this.duplexTicketItem_.isCapabilityAvailable());
        setIsVisible(this.cssBackgroundContainer_,
                     this.cssBackgroundTicketItem_.isCapabilityAvailable() &&
                     !this.collapseContent);
        setIsVisible(this.selectionOnlyContainer_,
                     this.selectionOnlyTicketItem_.isCapabilityAvailable() &&
                     !this.collapseContent);
      }
      print_preview.SettingsSection.prototype.updateUiStateInternal.call(this);
    },

    /** @override */
    isSectionVisibleInternal: function() {
      if (this.collapseContent) {
        return this.fitToPageTicketItem_.isCapabilityAvailable() ||
               this.duplexTicketItem_.isCapabilityAvailable();
      }

      return this.isAvailable();
    },

     /**
     * Called when the header-footer checkbox is clicked. Updates the print
     * ticket.
     * @private
     */
    onHeaderFooterCheckboxClick_: function() {
      this.headerFooterTicketItem_.updateValue(
          this.headerFooterCheckbox_.checked);
    },

    /**
     * Called when the fit-to-page checkbox is clicked. Updates the print
     * ticket.
     * @private
     */
    onFitToPageCheckboxClick_: function() {
      this.fitToPageTicketItem_.updateValue(this.fitToPageCheckbox_.checked);
    },

    /**
     * Called when the duplex checkbox is clicked. Updates the print ticket.
     * @private
     */
    onDuplexCheckboxClick_: function() {
      this.duplexTicketItem_.updateValue(this.duplexCheckbox_.checked);
    },

    /**
     * Called when the print CSS backgrounds checkbox is clicked. Updates the
     * print ticket store.
     * @private
     */
    onCssBackgroundCheckboxClick_: function() {
      this.cssBackgroundTicketItem_.updateValue(
          this.cssBackgroundCheckbox_.checked);
    },

    /**
     * Called when the print selection only is clicked. Updates the
     * print ticket store.
     * @private
     */
    onSelectionOnlyCheckboxClick_: function() {
      this.selectionOnlyTicketItem_.updateValue(
          this.selectionOnlyCheckbox_.checked);
    },

    /**
     * Called when the duplex ticket item has changed. Updates the duplex
     * checkbox.
     * @private
     */
    onDuplexChange_: function() {
      this.duplexCheckbox_.checked = this.duplexTicketItem_.getValue();
      this.updateUiStateInternal();
    },

    /**
     * Called when the fit-to-page ticket item has changed. Updates the
     * fit-to-page checkbox.
     * @private
     */
    onFitToPageChange_: function() {
      this.fitToPageCheckbox_.checked = this.fitToPageTicketItem_.getValue();
      this.updateUiStateInternal();
    },

    /**
     * Called when the CSS background ticket item has changed. Updates the
     * CSS background checkbox.
     * @private
     */
    onCssBackgroundChange_: function() {
      this.cssBackgroundCheckbox_.checked =
          this.cssBackgroundTicketItem_.getValue();
      this.updateUiStateInternal();
    },

    /**
     * Called when the print selection only ticket item has changed. Updates the
     * CSS background checkbox.
     * @private
     */
    onSelectionOnlyChange_: function() {
      this.selectionOnlyCheckbox_.checked =
          this.selectionOnlyTicketItem_.getValue();
      this.updateUiStateInternal();
    },

    /**
     * Called when the header-footer ticket item has changed. Updates the
     * header-footer checkbox.
     * @private
     */
    onHeaderFooterChange_: function() {
      this.headerFooterCheckbox_.checked =
          this.headerFooterTicketItem_.getValue();
      this.updateUiStateInternal();
    },
  };

  // Export
  return {
    OtherOptionsSettings: OtherOptionsSettings
  };
});

// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Print options section to control printer advanced options.
   * @param {!print_preview.ticket_item.VendorItems} ticketItem Ticket item to
   *     check settings availability.
   * @param {!print_preview.DestinationStore} destinationStore Used to determine
   *     the selected destination.
   * @constructor
   * @extends {print_preview.SettingsSection}
   */
  function AdvancedOptionsSettings(ticketItem, destinationStore) {
    print_preview.SettingsSection.call(this);

    /**
     * Ticket item to check settings availability.
     * @private {!print_preview.ticket_items.VendorItems}
     */
    this.ticketItem_ = ticketItem;

    /**
     * Used to determine the selected destination.
     * @private {!print_preview.DestinationStore}
     */
    this.destinationStore_ = destinationStore;
  };

  /**
   * Event types dispatched by the component.
   * @enum {string}
   */
  AdvancedOptionsSettings.EventType = {
    BUTTON_ACTIVATED: 'print_preview.AdvancedOptionsSettings.BUTTON_ACTIVATED'
  };

  AdvancedOptionsSettings.prototype = {
    __proto__: print_preview.SettingsSection.prototype,

    /** @override */
    isAvailable: function() {
      return this.ticketItem_.isCapabilityAvailable();
    },

    /** @override */
    hasCollapsibleContent: function() {
      return this.isAvailable();
    },

    /** @param {boolean} isEnabled Whether the component is enabled. */
    set isEnabled(isEnabled) {
      this.getButton_().disabled = !isEnabled;
    },

    /** @override */
    enterDocument: function() {
      print_preview.SettingsSection.prototype.enterDocument.call(this);

      this.tracker.add(
          this.getButton_(), 'click', function() {
            cr.dispatchSimpleEvent(
                this, AdvancedOptionsSettings.EventType.BUTTON_ACTIVATED);
          }.bind(this));
      this.tracker.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.DESTINATION_SELECT,
          this.onDestinationChanged_.bind(this));
      this.tracker.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.
              SELECTED_DESTINATION_CAPABILITIES_READY,
          this.onDestinationChanged_.bind(this));
    },

    /**
     * @return {HTMLElement}
     * @private
     */
    getButton_: function() {
      return this.getChildElement('.advanced-options-settings-button');
    },

    /**
     * Called when the destination selection has changed. Updates UI elements.
     * @private
     */
    onDestinationChanged_: function() {
      this.updateUiStateInternal();
    }
  };

  // Export
  return {
    AdvancedOptionsSettings: AdvancedOptionsSettings
  };
});

// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Modal dialog for print destination's advanced settings.
   * @param {!print_preview.PrintTicketStore} printTicketStore Contains the
   *     print ticket to print.
   * @constructor
   * @extends {print_preview.Overlay}
   */
  function AdvancedSettings(printTicketStore) {
    print_preview.Overlay.call(this);

    /**
     * Contains the print ticket to print.
     * @private {!print_preview.PrintTicketStore}
     */
    this.printTicketStore_ = printTicketStore;

    /**
     * Used to record usage statistics.
     * @private {!print_preview.PrintSettingsUiMetricsContext}
     */
    this.metrics_ = new print_preview.PrintSettingsUiMetricsContext();

    /** @private {!print_preview.SearchBox} */
    this.searchBox_ = new print_preview.SearchBox(
        loadTimeData.getString('advancedSettingsSearchBoxPlaceholder'));
    this.addChild(this.searchBox_);

    /** @private {print_preview.Destination} */
    this.destination_ = null;

    /** @private {!Array<!print_preview.AdvancedSettingsItem>} */
    this.items_ = [];
  };

  /**
   * CSS classes used by the component.
   * @enum {string}
   * @private
   */
  AdvancedSettings.Classes_ = {
    EXTRA_PADDING: 'advanced-settings-item-extra-padding'
  };

  AdvancedSettings.prototype = {
    __proto__: print_preview.Overlay.prototype,

    /**
     * @param {!print_preview.Destination} destination Destination to show
     *     advanced settings for.
     */
    showForDestination: function(destination) {
      assert(!this.destination_);
      this.destination_ = destination;
      this.getChildElement('.advanced-settings-title').textContent =
          loadTimeData.getStringF('advancedSettingsDialogTitle',
                                  this.destination_.displayName);
      this.setIsVisible(true);
      this.renderSettings_();
    },

    /** @override */
    enterDocument: function() {
      print_preview.Overlay.prototype.enterDocument.call(this);

      this.tracker.add(
          this.getChildElement('.button-strip .cancel-button'),
          'click',
          this.cancel.bind(this));

      this.tracker.add(
          this.getChildElement('.button-strip .done-button'),
          'click',
          this.onApplySettings_.bind(this));

      this.tracker.add(
          this.searchBox_,
          print_preview.SearchBox.EventType.SEARCH,
          this.onSearch_.bind(this));
    },

    /** @override */
    decorateInternal: function() {
      this.searchBox_.render(this.getChildElement('.search-box-area'));
    },

    /** @override */
    onSetVisibleInternal: function(isVisible) {
      if (isVisible) {
        this.searchBox_.focus();
        this.metrics_.record(print_preview.Metrics.PrintSettingsUiBucket.
            ADVANCED_SETTINGS_DIALOG_SHOWN);
      } else {
        this.resetSearch_();
        this.destination_ = null;
      }
    },

    /** @override */
    onCancelInternal: function() {
      this.metrics_.record(print_preview.Metrics.PrintSettingsUiBucket.
          ADVANCED_SETTINGS_DIALOG_CANCELED);
    },

    /** @override */
    onEnterPressedInternal: function() {
      var doneButton = this.getChildElement('.button-strip .done-button');
      if (!doneButton.disabled)
        doneButton.click();
      return !doneButton.disabled;
    },

    /**
     * @return {number} Height available for settings, in pixels.
     * @private
     */
    getAvailableContentHeight_: function() {
      var elStyle = window.getComputedStyle(this.getElement());
      return this.getElement().offsetHeight -
          parseInt(elStyle.getPropertyValue('padding-top'), 10) -
          parseInt(elStyle.getPropertyValue('padding-bottom'), 10) -
          this.getChildElement('.settings-area').offsetTop -
          this.getChildElement('.action-area').offsetHeight;
    },

    /**
     * Filters displayed settings with the given query.
     * @param {?string} query Query to filter settings by.
     * @private
     */
    filterLists_: function(query) {
      var atLeastOneMatch = false;
      var lastVisibleItemWithBubble = null;
      this.items_.forEach(function(item) {
        item.updateSearchQuery(query);
        if (getIsVisible(item.getElement()))
          atLeastOneMatch = true;
        if (item.searchBubbleShown)
          lastVisibleItemWithBubble = item;
      });
      setIsVisible(
          this.getChildElement('.no-settings-match-hint'), !atLeastOneMatch);
      setIsVisible(
          this.getChildElement('.' + AdvancedSettings.Classes_.EXTRA_PADDING),
          !!lastVisibleItemWithBubble);
    },

    /**
     * Resets the filter query.
     * @private
     */
    resetSearch_: function() {
      this.searchBox_.setQuery(null);
      this.filterLists_(null);
    },

    /**
     * Renders all of the available settings.
     * @private
     */
    renderSettings_: function() {
      // Remove all children settings elements.
      this.items_.forEach(function(item) {
        this.removeChild(item);
      }.bind(this));
      this.items_ = [];

      var extraPadding =
          this.getChildElement('.' + AdvancedSettings.Classes_.EXTRA_PADDING);
      if (extraPadding)
        extraPadding.parentNode.removeChild(extraPadding);

      var vendorCapabilities = this.printTicketStore_.vendorItems.capability;
      if (!vendorCapabilities)
        return;

      var availableHeight = this.getAvailableContentHeight_();
      var containerEl = this.getChildElement('.settings-area');
      containerEl.style.maxHeight = availableHeight + 'px';
      var settingsEl = this.getChildElement('.settings');

      vendorCapabilities.forEach(function(capability) {
        var item = new print_preview.AdvancedSettingsItem(
            this.eventTarget_, this.printTicketStore_, capability);
        this.addChild(item);
        item.render(settingsEl);
        this.items_.push(item);
      }.bind(this));

      if (this.items_.length <= 1) {
        setIsVisible(this.getChildElement('.search-box-area'), false);
      } else {
        setIsVisible(this.getChildElement('.search-box-area'), true);
        this.searchBox_.focus();
      }

      extraPadding = document.createElement('div');
      extraPadding.classList.add(AdvancedSettings.Classes_.EXTRA_PADDING);
      extraPadding.hidden = true;
      settingsEl.appendChild(extraPadding);
    },

    /**
     * Called when settings search query changes. Filters displayed settings
     * with the given query.
     * @param {Event} evt Contains search query.
     * @private
     */
    onSearch_: function(evt) {
      this.filterLists_(evt.queryRegExp);
    },

    /**
     * Called when current settings selection need to be stored in the ticket.
     * @private
     */
    onApplySettings_: function(evt) {
      this.setIsVisible(false);

      var values = {};
      this.items_.forEach(function(item) {
        if (item.isModified())
          values[item.id] = item.selectedValue;
      }.bind(this));

      this.printTicketStore_.vendorItems.updateValue(values);
    }
  };

  // Export
  return {
    AdvancedSettings: AdvancedSettings
  };
});

// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Component that renders a destination item in a destination list.
   * @param {!cr.EventTarget} eventTarget Event target to dispatch selection
   *     events to.
   * @param {!print_preview.PrintTicketStore} printTicketStore Contains the
   *     print ticket to print.
   * @param {!Object} capability Capability to render.
   * @constructor
   * @extends {print_preview.Component}
   */
  function AdvancedSettingsItem(eventTarget, printTicketStore, capability) {
    print_preview.Component.call(this);

    /**
     * Event target to dispatch selection events to.
     * @private {!cr.EventTarget}
     */
    this.eventTarget_ = eventTarget;

    /**
     * Contains the print ticket to print.
     * @private {!print_preview.PrintTicketStore}
     */
    this.printTicketStore_ = printTicketStore;

    /**
     * Capability this component renders.
     * @private {!Object}
     */
    this.capability_ = capability;

    /**
     * Value selected by user. {@code null}, if user has not changed the default
     * value yet (still, the value can be the default one, if it is what user
     * selected).
     * @private {?string}
     */
    this.selectedValue_ = null;

    /**
     * Active filter query.
     * @private {RegExp}
     */
    this.query_ = null;

    /**
     * Search hint for the control.
     * @private {print_preview.SearchBubble}
     */
    this.searchBubble_ = null;

    /** @private {!EventTracker} */
    this.tracker_ = new EventTracker();
  };

  AdvancedSettingsItem.prototype = {
    __proto__: print_preview.Component.prototype,

    /** @override */
    createDom: function() {
      this.setElementInternal(this.cloneTemplateInternal(
          'advanced-settings-item-template'));

      this.tracker_.add(
          this.select_, 'change', this.onSelectChange_.bind(this));
      this.tracker_.add(this.text_, 'input', this.onTextInput_.bind(this));

      this.initializeValue_();

      this.renderCapability_();
    },

    /**
     * ID of the corresponding vendor capability.
     * @return {string}
     */
    get id() {
      return this.capability_.id;
    },

    /**
     * Currently selected value.
     * @return {string}
     */
    get selectedValue() {
      return this.selectedValue_ || '';
    },

    /**
     * Whether the corresponding ticket item was changed or not.
     * @return {boolean}
     */
    isModified: function() {
      return !!this.selectedValue_;
    },

    /** @param {RegExp} query Query to update the filter with. */
    updateSearchQuery: function(query) {
      this.query_ = query;
      this.renderCapability_();
    },

    get searchBubbleShown() {
      return getIsVisible(this.getElement()) && !!this.searchBubble_;
    },

    /**
     * @return {HTMLSelectElement} Select element.
     * @private
     */
    get select_() {
      return this.getChildElement(
          '.advanced-settings-item-value-select-control');
    },

    /**
     * @return {HTMLSelectElement} Text element.
     * @private
     */
    get text_() {
      return this.getChildElement('.advanced-settings-item-value-text-control');
    },

    /**
     * Called when the select element value is changed.
     * @private
     */
    onSelectChange_: function() {
      this.selectedValue_ = this.select_.value;
    },

    /**
     * Called when the text element value is changed.
     * @private
     */
    onTextInput_: function() {
      this.selectedValue_ = this.text_.value || null;

      if (this.query_) {
        var optionMatches = (this.selectedValue_ || '').match(this.query_);
        // Even if there's no match anymore, keep the item visible to do not
        // surprise user. Even if there's a match, do not show the bubble, user
        // is already aware that this option is visible and matches the search.
        // Showing the bubble will only create a distraction by moving UI
        // elements around.
        if (!optionMatches)
          this.hideSearchBubble_();
      }
    },

    /**
     * @param {!Object} entity Entity to get the display name for. Entity in
     *     is either a vendor capability or vendor capability option.
     * @return {string} The entity display name.
     * @private
     */
    getEntityDisplayName_: function(entity) {
      var displayName = entity.display_name;
      if (!displayName && entity.display_name_localized)
        displayName = getStringForCurrentLocale(entity.display_name_localized);
      return displayName || '';
    },

    /**
     * Renders capability properties according to the current state.
     * @private
     */
    renderCapability_: function() {
      var textContent = this.getEntityDisplayName_(this.capability_);
      // Whether capability name matches the query.
      var nameMatches = this.query_ ? !!textContent.match(this.query_) : true;
      // An array of text segments of the capability value matching the query.
      var optionMatches = null;
      if (this.query_) {
        if (this.capability_.type == 'SELECT') {
          // Look for the first option that matches the query.
          for (var i = 0; i < this.select_.length && !optionMatches; i++)
            optionMatches = this.select_.options[i].text.match(this.query_);
        } else {
          optionMatches = (this.text_.value || this.text_.placeholder || '')
              .match(this.query_);
        }
      }
      var matches = nameMatches || !!optionMatches;

      if (!optionMatches)
        this.hideSearchBubble_();

      setIsVisible(this.getElement(), matches);
      if (!matches)
        return;

      var nameEl = this.getChildElement('.advanced-settings-item-label');
      if (this.query_) {
        nameEl.textContent = '';
        this.addTextWithHighlight_(nameEl, textContent);
      } else {
        nameEl.textContent = textContent;
      }
      nameEl.title = textContent;

      if (optionMatches)
        this.showSearchBubble_(optionMatches[0]);
    },

    /**
     * Shows search bubble for this element.
     * @param {string} text Text to show in the search bubble.
     * @private
     */
    showSearchBubble_: function(text) {
      var element =
          this.capability_.type == 'SELECT' ? this.select_ : this.text_;
      if (!this.searchBubble_) {
        this.searchBubble_ = new print_preview.SearchBubble(text);
        this.searchBubble_.attachTo(element);
      } else {
        this.searchBubble_.content = text;
      }
    },

    /**
     * Hides search bubble associated with this element.
     * @private
     */
    hideSearchBubble_: function() {
      if (this.searchBubble_) {
        this.searchBubble_.dispose();
        this.searchBubble_ = null;
      }
    },

    /**
     * Initializes the element's value control.
     * @private
     */
    initializeValue_: function() {
      this.selectedValue_ =
          this.printTicketStore_.vendorItems.ticketItems[this.id] || null;

      if (this.capability_.type == 'SELECT')
        this.initializeSelectValue_();
      else
        this.initializeTextValue_();
    },

    /**
     * Initializes the select element.
     * @private
     */
    initializeSelectValue_: function() {
      setIsVisible(
          this.getChildElement('.advanced-settings-item-value-select'), true);
      var selectEl = this.select_;
      var indexToSelect = 0;
      this.capability_.select_cap.option.forEach(function(option, index) {
        var item = document.createElement('option');
        item.text = this.getEntityDisplayName_(option);
        item.value = option.value;
        if (option.is_default)
          indexToSelect = index;
        selectEl.appendChild(item);
      }, this);
      for (var i = 0, option; option = selectEl.options[i]; i++) {
        if (option.value == this.selectedValue_) {
          indexToSelect = i;
          break;
        }
      }
      selectEl.selectedIndex = indexToSelect;
    },

    /**
     * Initializes the text element.
     * @private
     */
    initializeTextValue_: function() {
      setIsVisible(
          this.getChildElement('.advanced-settings-item-value-text'), true);

      var defaultValue = null;
      if (this.capability_.type == 'TYPED_VALUE' &&
          this.capability_.typed_value_cap) {
        defaultValue = this.capability_.typed_value_cap.default || null;
      } else if (this.capability_.type == 'RANGE' &&
                 this.capability_.range_cap) {
        defaultValue = this.capability_.range_cap.default || null;
      }

      this.text_.placeholder = defaultValue || '';

      this.text_.value = this.selectedValue;
    },

    /**
     * Adds text to parent element wrapping search query matches in highlighted
     * spans.
     * @param {!Element} parent Element to build the text in.
     * @param {string} text The text string to highlight segments in.
     * @private
     */
    addTextWithHighlight_: function(parent, text) {
      text.split(this.query_).forEach(function(section, i) {
        if (i % 2 == 0) {
          parent.appendChild(document.createTextNode(section));
        } else {
          var span = document.createElement('span');
          span.className = 'advanced-settings-item-query-highlight';
          span.textContent = section;
          parent.appendChild(span);
        }
      });
    }
  };

  // Export
  return {
    AdvancedSettingsItem: AdvancedSettingsItem
  };
});

// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Toggles visibility of the specified printing options sections.
   * @param {!print_preview.DestinationStore} destinationStore To listen for
   *     destination changes.
   * @param {!Array<print_preview.SettingsSection>} settingsSections Sections
   *     to toggle by this component.
   * @constructor
   * @extends {print_preview.Component}
   */
  function MoreSettings(destinationStore, settingsSections) {
    print_preview.Component.call(this);

    /** @private {!print_preview.DestinationStore} */
    this.destinationStore_ = destinationStore;

    /** @private {!Array<print_preview.SettingsSection>} */
    this.settingsSections_ = settingsSections;

    /** @private {MoreSettings.SettingsToShow} */
    this.settingsToShow_ = MoreSettings.SettingsToShow.MOST_POPULAR;

    /** @private {boolean} */
    this.capabilitiesReady_ = false;

    /** @private {boolean} */
    this.firstDestinationReady_ = false;

    /**
     * Used to record usage statistics.
     * @private {!print_preview.PrintSettingsUiMetricsContext}
     */
    this.metrics_ = new print_preview.PrintSettingsUiMetricsContext();
  };

  /**
   * Which settings are visible to the user.
   * @enum {number}
   */
  MoreSettings.SettingsToShow = {
    MOST_POPULAR: 1,
    ALL: 2
  };

  MoreSettings.prototype = {
    __proto__: print_preview.Component.prototype,

    /** @return {boolean} Returns {@code true} if settings are expanded. */
    get isExpanded() {
      return this.settingsToShow_ == MoreSettings.SettingsToShow.ALL;
    },

    /** @override */
    enterDocument: function() {
      print_preview.Component.prototype.enterDocument.call(this);

      this.tracker.add(this.getElement(), 'click', this.onClick_.bind(this));
      this.tracker.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.DESTINATION_SELECT,
          this.onDestinationChanged_.bind(this));
      this.tracker.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.
              SELECTED_DESTINATION_CAPABILITIES_READY,
          this.onDestinationCapabilitiesReady_.bind(this));
      this.settingsSections_.forEach(function(section) {
        this.tracker.add(
            section,
            print_preview.SettingsSection.EventType.COLLAPSIBLE_CONTENT_CHANGED,
            this.updateState_.bind(this));
      }.bind(this));

      this.updateState_(true);
    },

    /**
     * Toggles "more/fewer options" state and notifies all the options sections
     *     to reflect the new state.
     * @private
     */
    onClick_: function() {
      this.settingsToShow_ =
          this.settingsToShow_ == MoreSettings.SettingsToShow.MOST_POPULAR ?
              MoreSettings.SettingsToShow.ALL :
              MoreSettings.SettingsToShow.MOST_POPULAR;
      this.updateState_(false);
      this.metrics_.record(this.isExpanded ?
          print_preview.Metrics.PrintSettingsUiBucket.MORE_SETTINGS_CLICKED :
          print_preview.Metrics.PrintSettingsUiBucket.LESS_SETTINGS_CLICKED);
    },

    /**
     * Called when the destination selection has changed. Updates UI elements.
     * @private
     */
    onDestinationChanged_: function() {
      this.firstDestinationReady_ = true;
      this.capabilitiesReady_ = false;
      this.updateState_(false);
    },

    /**
     * Called when the destination selection has changed. Updates UI elements.
     * @private
     */
    onDestinationCapabilitiesReady_: function() {
      this.capabilitiesReady_ = true;
      this.updateState_(false);
    },

    /**
     * Updates the component appearance according to the current state.
     * @param {boolean} noAnimation Whether section visibility transitions
     *     should not be animated.
     * @private
     */
    updateState_: function(noAnimation) {
      if (!this.firstDestinationReady_) {
        fadeOutElement(this.getElement());
        return;
      }
      // When capabilities are not known yet, don't change the state to avoid
      // unnecessary fade in/out cycles.
      if (!this.capabilitiesReady_)
        return;

      var all = this.settingsToShow_ == MoreSettings.SettingsToShow.ALL;
      this.getChildElement('.more-settings-label').textContent =
          loadTimeData.getString(all ? 'lessOptionsLabel' : 'moreOptionsLabel');
      var iconEl = this.getChildElement('.more-settings-icon');
      iconEl.classList.toggle('more-settings-icon-plus', !all);
      iconEl.classList.toggle('more-settings-icon-minus', all);

      var availableSections = this.settingsSections_.reduce(
          function(count, section) {
            return count + (section.isAvailable() ? 1 : 0);
          }, 0);

      // Magic 6 is chosen as the number of sections when it still feels like
      // manageable and not too crowded.
      var hasSectionsToToggle =
          availableSections > 6 &&
          this.settingsSections_.some(function(section) {
            return section.hasCollapsibleContent();
          });

      if (hasSectionsToToggle)
        fadeInElement(this.getElement(), noAnimation);
      else
        fadeOutElement(this.getElement());

      var collapseContent =
          this.settingsToShow_ == MoreSettings.SettingsToShow.MOST_POPULAR &&
          hasSectionsToToggle;
      this.settingsSections_.forEach(function(section) {
        section.setCollapseContent(collapseContent, noAnimation);
      });
    }
  };

  // Export
  return {
    MoreSettings: MoreSettings
  };
});


// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Draggable control for setting a page margin.
   * @param {!print_preview.ticket_items.CustomMargins.Orientation} orientation
   *     Orientation of the margin control that determines where the margin
   *     textbox will be placed.
   * @constructor
   * @extends {print_preview.Component}
   */
  function MarginControl(orientation) {
    print_preview.Component.call(this);

    /**
     * Determines where the margin textbox will be placed.
     * @type {!print_preview.ticket_items.CustomMargins.Orientation}
     * @private
     */
    this.orientation_ = orientation;

    /**
     * Position of the margin control in points.
     * @type {number}
     * @private
     */
    this.positionInPts_ = 0;

    /**
     * Page size of the document to print.
     * @type {!print_preview.Size}
     * @private
     */
    this.pageSize_ = new print_preview.Size(0, 0);

    /**
     * Amount to scale pixel values by to convert to pixel space.
     * @type {number}
     * @private
     */
    this.scaleTransform_ = 1;

    /**
     * Amount to translate values in pixel space.
     * @type {!print_preview.Coordinate2d}
     * @private
     */
    this.translateTransform_ = new print_preview.Coordinate2d(0, 0);

    /**
     * Position of the margin control when dragging starts.
     * @type {print_preview.Coordinate2d}
     * @private
     */
    this.marginStartPositionInPixels_ = null;

    /**
     * Position of the mouse when the dragging starts.
     * @type {print_preview.Coordinate2d}
     * @private
     */
    this.mouseStartPositionInPixels_ = null;

    /**
     * Processing timeout for the textbox.
     * @type {?number}
     * @private
     */
    this.textTimeout_ = null;

    /**
     * Textbox used to display and receive the value of the margin.
     * @type {HTMLInputElement}
     * @private
     */
    this.textbox_ = null;

    /**
     * Element of the margin control line.
     * @type {HTMLElement}
     * @private
     */
    this.marginLineEl_ = null;

    /**
     * Whether this margin control's textbox has keyboard focus.
     * @type {boolean}
     * @private
     */
    this.isFocused_ = false;

    /**
     * Whether the margin control is in an error state.
     * @type {boolean}
     * @private
     */
    this.isInError_ = false;
  };

  /**
   * Event types dispatched by the margin control.
   * @enum {string}
   */
  MarginControl.EventType = {
    // Dispatched when the margin control starts dragging.
    DRAG_START: 'print_preview.MarginControl.DRAG_START',

    // Dispatched when the text in the margin control's textbox changes.
    TEXT_CHANGE: 'print_preview.MarginControl.TEXT_CHANGE'
  };

  /**
   * CSS classes used by this component.
   * @enum {string}
   * @private
   */
  MarginControl.Classes_ = {
    TEXTBOX: 'margin-control-textbox',
    DRAGGING: 'margin-control-dragging',
    LINE: 'margin-control-line'
  };

  /**
   * Radius of the margin control in pixels. Padding of control + 1 for border.
   * @type {number}
   * @const
   * @private
   */
  MarginControl.RADIUS_ = 9;

  /**
   * Timeout after a text change after which the text in the textbox is saved to
   * the print ticket. Value in milliseconds.
   * @type {number}
   * @const
   * @private
   */
  MarginControl.TEXTBOX_TIMEOUT_ = 1000;

  MarginControl.prototype = {
    __proto__: print_preview.Component.prototype,

    /** @return {boolean} Whether this margin control is in focus. */
    getIsFocused: function() {
      return this.isFocused_;
    },

    /**
     * @return {!print_preview.ticket_items.CustomMargins.Orientation}
     *     Orientation of the margin control.
     */
    getOrientation: function() {
      return this.orientation_;
    },

    /**
     * @param {number} scaleTransform New scale transform of the margin control.
     */
    setScaleTransform: function(scaleTransform) {
      this.scaleTransform_ = scaleTransform;
      // Reset position
      this.setPositionInPts(this.positionInPts_);
    },

    /**
     * @param {!print_preview.Coordinate2d} translateTransform New translate
     *     transform of the margin control.
     */
    setTranslateTransform: function(translateTransform) {
      this.translateTransform_ = translateTransform;
      // Reset position
      this.setPositionInPts(this.positionInPts_);
    },

    /**
     * @param {!print_preview.Size} pageSize New size of the document's pages.
     */
    setPageSize: function(pageSize) {
      this.pageSize_ = pageSize;
      this.setPositionInPts(this.positionInPts_);
    },

    /** @param {boolean} isVisible Whether the margin control is visible. */
    setIsVisible: function(isVisible) {
      this.getElement().classList.toggle('invisible', !isVisible);
    },

    /** @return {boolean} Whether the margin control is in an error state. */
    getIsInError: function() {
      return this.isInError_;
    },

    /**
     * @param {boolean} isInError Whether the margin control is in an error
     *     state.
     */
    setIsInError: function(isInError) {
      this.isInError_ = isInError;
      this.textbox_.classList.toggle('invalid', isInError);
    },

    /** @param {boolean} isEnabled Whether to enable the margin control. */
    setIsEnabled: function(isEnabled) {
      this.textbox_.disabled = !isEnabled;
      this.getElement().classList.toggle('margin-control-disabled', !isEnabled);
    },

    /** @return {number} Current position of the margin control in points. */
    getPositionInPts: function() {
      return this.positionInPts_;
    },

    /**
     * @param {number} posInPts New position of the margin control in points.
     */
    setPositionInPts: function(posInPts) {
      this.positionInPts_ = posInPts;
      var orientationEnum =
          print_preview.ticket_items.CustomMargins.Orientation;
      var x = this.translateTransform_.x;
      var y = this.translateTransform_.y;
      var width = null, height = null;
      if (this.orientation_ == orientationEnum.TOP) {
        y = this.scaleTransform_ * posInPts + this.translateTransform_.y -
            MarginControl.RADIUS_;
        width = this.scaleTransform_ * this.pageSize_.width;
      } else if (this.orientation_ == orientationEnum.RIGHT) {
        x = this.scaleTransform_ * (this.pageSize_.width - posInPts) +
            this.translateTransform_.x - MarginControl.RADIUS_;
        height = this.scaleTransform_ * this.pageSize_.height;
      } else if (this.orientation_ == orientationEnum.BOTTOM) {
        y = this.scaleTransform_ * (this.pageSize_.height - posInPts) +
            this.translateTransform_.y - MarginControl.RADIUS_;
        width = this.scaleTransform_ * this.pageSize_.width;
      } else {
        x = this.scaleTransform_ * posInPts + this.translateTransform_.x -
            MarginControl.RADIUS_;
        height = this.scaleTransform_ * this.pageSize_.height;
      }
      this.getElement().style.left = Math.round(x) + 'px';
      this.getElement().style.top = Math.round(y) + 'px';
      if (width != null) {
        this.getElement().style.width = Math.round(width) + 'px';
      }
      if (height != null) {
        this.getElement().style.height = Math.round(height) + 'px';
      }
    },

    /** @return {string} The value in the margin control's textbox. */
    getTextboxValue: function() {
      return this.textbox_.value;
    },

    /** @param {string} value New value of the margin control's textbox. */
    setTextboxValue: function(value) {
      if (this.textbox_.value != value) {
        this.textbox_.value = value;
      }
    },

    /**
     * Converts a value in pixels to points.
     * @param {number} pixels Pixel value to convert.
     * @return {number} Given value expressed in points.
     */
    convertPixelsToPts: function(pixels) {
      var pts;
      var orientationEnum =
          print_preview.ticket_items.CustomMargins.Orientation;
      if (this.orientation_ == orientationEnum.TOP) {
        pts = pixels - this.translateTransform_.y + MarginControl.RADIUS_;
        pts /= this.scaleTransform_;
      } else if (this.orientation_ == orientationEnum.RIGHT) {
        pts = pixels - this.translateTransform_.x + MarginControl.RADIUS_;
        pts /= this.scaleTransform_;
        pts = this.pageSize_.width - pts;
      } else if (this.orientation_ == orientationEnum.BOTTOM) {
        pts = pixels - this.translateTransform_.y + MarginControl.RADIUS_;
        pts /= this.scaleTransform_;
        pts = this.pageSize_.height - pts;
      } else {
        pts = pixels - this.translateTransform_.x + MarginControl.RADIUS_;
        pts /= this.scaleTransform_;
      }
      return pts;
    },

    /**
     * Translates the position of the margin control relative to the mouse
     * position in pixels.
     * @param {!print_preview.Coordinate2d} mousePosition New position of
     *     the mouse.
     * @return {!print_preview.Coordinate2d} New position of the margin control.
     */
    translateMouseToPositionInPixels: function(mousePosition) {
      return new print_preview.Coordinate2d(
          mousePosition.x - this.mouseStartPositionInPixels_.x +
              this.marginStartPositionInPixels_.x,
          mousePosition.y - this.mouseStartPositionInPixels_.y +
              this.marginStartPositionInPixels_.y);
    },

    /** @override */
    createDom: function() {
      this.setElementInternal(this.cloneTemplateInternal(
          'margin-control-template'));
      this.getElement().classList.add('margin-control-' + this.orientation_);
      this.textbox_ = this.getElement().getElementsByClassName(
          MarginControl.Classes_.TEXTBOX)[0];
      this.textbox_.setAttribute(
          'aria-label', loadTimeData.getString(this.orientation_));
      this.marginLineEl_ = this.getElement().getElementsByClassName(
          MarginControl.Classes_.LINE)[0];
    },

    /** @override */
    enterDocument: function() {
      print_preview.Component.prototype.enterDocument.call(this);
      this.tracker.add(
          this.getElement(), 'mousedown', this.onMouseDown_.bind(this));
      this.tracker.add(
          this.getElement(),
          'webkitTransitionEnd',
          this.onWebkitTransitionEnd_.bind(this));
      this.tracker.add(
          this.textbox_, 'input', this.onTextboxInput_.bind(this));
      this.tracker.add(
          this.textbox_, 'keydown', this.onTextboxKeyDown_.bind(this));
      this.tracker.add(
          this.textbox_, 'focus', this.setIsFocused_.bind(this, true));
      this.tracker.add(this.textbox_, 'blur', this.onTexboxBlur_.bind(this));
    },

    /** @override */
    exitDocument: function() {
      print_preview.Component.prototype.exitDocument.call(this);
      this.textbox_ = null;
      this.marginLineEl_ = null;
    },

    /**
     * @param {boolean} isFocused Whether the margin control is in focus.
     * @private
     */
    setIsFocused_: function(isFocused) {
      this.isFocused_ = isFocused;
      // TODO(tkent): This is a workaround of a preview-area scrolling
      // issue. Blink scrolls preview-area on focus, but we don't want it.  We
      // should adjust scroll position of PDF preview and positions of
      // MarginContgrols here, or restructure the HTML so that the PDF review
      // and MarginControls are on the single scrollable container.
      // crbug.com/601341
      if (isFocused) {
        var previewArea = $('preview-area');
        previewArea.scrollTop = 0;
        previewArea.scrollLeft = 0;
      }
    },

    /**
     * Called whenever a mousedown event occurs on the component.
     * @param {MouseEvent} event The event that occured.
     * @private
     */
    onMouseDown_: function(event) {
      if (!this.textbox_.disabled &&
          event.button == 0 &&
          (event.target == this.getElement() ||
              event.target == this.marginLineEl_)) {
        this.mouseStartPositionInPixels_ =
            new print_preview.Coordinate2d(event.x, event.y);
        this.marginStartPositionInPixels_ = new print_preview.Coordinate2d(
            this.getElement().offsetLeft, this.getElement().offsetTop);
        this.setIsInError(false);
        cr.dispatchSimpleEvent(this, MarginControl.EventType.DRAG_START);
      }
    },

    /**
     * Called when opacity CSS transition ends.
     * @private
     */
    onWebkitTransitionEnd_: function(event) {
      if (event.propertyName != 'opacity')
        return;
      var elStyle = window.getComputedStyle(this.getElement());
      var disabled = parseInt(elStyle.getPropertyValue('opacity'), 10) == 0;
      this.textbox_.setAttribute('aria-hidden', disabled);
      this.textbox_.disabled = disabled;
    },

    /**
     * Called when textbox content changes. Starts text change timeout.
     * @private
     */
    onTextboxInput_: function(event) {
      if (this.textTimeout_) {
        clearTimeout(this.textTimeout_);
        this.textTimeout_ = null;
      }
      this.textTimeout_ = setTimeout(
          this.onTextboxTimeout_.bind(this), MarginControl.TEXTBOX_TIMEOUT_);
    },

    /**
     * Called when a key down event occurs on the textbox. Dispatches a
     * TEXT_CHANGE event if the "Enter" key was pressed.
     * @param {Event} event Contains the key that was pressed.
     * @private
     */
    onTextboxKeyDown_: function(event) {
      if (this.textTimeout_) {
        clearTimeout(this.textTimeout_);
        this.textTimeout_ = null;
      }
      if (event.keyCode == 13 /*enter*/) {
        cr.dispatchSimpleEvent(this, MarginControl.EventType.TEXT_CHANGE);
      }
    },

    /**
     * Called after a timeout after the text in the textbox has changed. Saves
     * the textbox's value to the print ticket.
     * @private
     */
    onTextboxTimeout_: function() {
      this.textTimeout_ = null;
      cr.dispatchSimpleEvent(this, MarginControl.EventType.TEXT_CHANGE);
    },

    /**
     * Called when the textbox loses focus. Dispatches a TEXT_CHANGE event.
     */
    onTexboxBlur_: function() {
      if (this.textTimeout_) {
        clearTimeout(this.textTimeout_);
        this.textTimeout_ = null;
      }
      this.setIsFocused_(false);
      cr.dispatchSimpleEvent(this, MarginControl.EventType.TEXT_CHANGE);
    }
  };

  // Export
  return {
    MarginControl: MarginControl
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * UI component used for setting custom print margins.
   * @param {!print_preview.DocumentInfo} documentInfo Document data model.
   * @param {!print_preview.ticket_items.MarginsType} marginsTypeTicketItem
   *     Used to read margins type.
   * @param {!print_preview.ticket_items.CustomMargins} customMarginsTicketItem
   *     Used to read and write custom margin values.
   * @param {!print_preview.MeasurementSystem} measurementSystem Used to convert
   *     between the system's local units and points.
   * @param {function(boolean)} dragChangedCallback A function which is called
   *     when dragging margins starts or stops. True is passed to the function
   *     if the margin is currently being dragged and false otherwise.
   * @constructor
   * @extends {print_preview.Component}
   */
  function MarginControlContainer(documentInfo, marginsTypeTicketItem,
                                  customMarginsTicketItem, measurementSystem,
                                  dragChangedCallback) {
    print_preview.Component.call(this);

    /**
     * Document data model.
     * @type {!print_preview.DocumentInfo}
     * @private
     */
    this.documentInfo_ = documentInfo;

    /**
     * Margins type ticket item used to read predefined margins type.
     */
    this.marginsTypeTicketItem_ = marginsTypeTicketItem;

    /**
     * Custom margins ticket item used to read/write custom margin values.
     * @type {!print_preview.ticket_items.CustomMargins}
     * @private
     */
    this.customMarginsTicketItem_ = customMarginsTicketItem;

    /**
     * Used to convert between the system's local units and points.
     * @type {!print_preview.MeasurementSystem}
     * @private
     */
    this.measurementSystem_ = measurementSystem;

    /**
     * Called in response to dragging the margins starting or stopping. True is
     * passed to the function if the margin is currently being dragged and false
     * otherwise.
     * @type {function(boolean)}
     * @private
     */
    this.dragChangedCallback_ = dragChangedCallback;

    /**
     * Convenience array that contains all of the margin controls.
     * @type {!Object<
     *     !print_preview.ticket_items.CustomMargins.Orientation,
     *     !print_preview.MarginControl>}
     * @private
     */
    this.controls_ = {};
    for (var key in print_preview.ticket_items.CustomMargins.Orientation) {
      var orientation = print_preview.ticket_items.CustomMargins.Orientation[
          key];
      var control = new print_preview.MarginControl(orientation);
      this.controls_[orientation] = control;
      this.addChild(control);
    }

    /**
     * Margin control currently being dragged. Null if no control is being
     * dragged.
     * @type {print_preview.MarginControl}
     * @private
     */
    this.draggedControl_ = null;

    /**
     * Translation transformation in pixels to translate from the origin of the
     * custom margins component to the top-left corner of the most visible
     * preview page.
     * @type {!print_preview.Coordinate2d}
     * @private
     */
    this.translateTransform_ = new print_preview.Coordinate2d(0, 0);

    /**
     * Scaling transformation to scale from pixels to the units which the
     * print preview is in. The scaling factor is the same in both dimensions,
     * so this field is just a single number.
     * @type {number}
     * @private
     */
    this.scaleTransform_ = 1;

    /**
     * Clipping size for clipping the margin controls.
     * @type {print_preview.Size}
     * @private
     */
    this.clippingSize_ = null;
  };

  /**
   * CSS classes used by the custom margins component.
   * @enum {string}
   * @private
   */
  MarginControlContainer.Classes_ = {
    DRAGGING_HORIZONTAL: 'margin-control-container-dragging-horizontal',
    DRAGGING_VERTICAL: 'margin-control-container-dragging-vertical'
  };

  /**
   * @param {!print_preview.ticket_items.CustomMargins.Orientation} orientation
   *     Orientation value to test.
   * @return {boolean} Whether the given orientation is TOP or BOTTOM.
   * @private
   */
  MarginControlContainer.isTopOrBottom_ = function(orientation) {
    return orientation ==
        print_preview.ticket_items.CustomMargins.Orientation.TOP ||
        orientation ==
            print_preview.ticket_items.CustomMargins.Orientation.BOTTOM;
  };

  MarginControlContainer.prototype = {
    __proto__: print_preview.Component.prototype,

    /**
     * Updates the translation transformation that translates pixel values in
     * the space of the HTML DOM.
     * @param {print_preview.Coordinate2d} translateTransform Updated value of
     *     the translation transformation.
     */
    updateTranslationTransform: function(translateTransform) {
      if (!translateTransform.equals(this.translateTransform_)) {
        this.translateTransform_ = translateTransform;
        for (var orientation in this.controls_) {
          this.controls_[orientation].setTranslateTransform(translateTransform);
        }
      }
    },

    /**
     * Updates the scaling transform that scales pixels values to point values.
     * @param {number} scaleTransform Updated value of the scale transform.
     */
    updateScaleTransform: function(scaleTransform) {
      if (scaleTransform != this.scaleTransform_) {
        this.scaleTransform_ = scaleTransform;
        for (var orientation in this.controls_) {
          this.controls_[orientation].setScaleTransform(scaleTransform);
        }
      }
    },

    /**
     * Clips margin controls to the given clip size in pixels.
     * @param {print_preview.Size} clipSize Size to clip the margin controls to.
     */
    updateClippingMask: function(clipSize) {
      if (!clipSize) {
        return;
      }
      this.clippingSize_ = clipSize;
      for (var orientation in this.controls_) {
        var el = this.controls_[orientation].getElement();
        el.style.clip = 'rect(' +
            (-el.offsetTop) + 'px, ' +
            (clipSize.width - el.offsetLeft) + 'px, ' +
            (clipSize.height - el.offsetTop) + 'px, ' +
            (-el.offsetLeft) + 'px)';
      }
    },

    /** Shows the margin controls if the need to be shown. */
    showMarginControlsIfNeeded: function() {
      if (this.marginsTypeTicketItem_.getValue() ==
          print_preview.ticket_items.MarginsType.Value.CUSTOM) {
        this.setIsMarginControlsVisible_(true);
      }
    },

    /** @override */
    enterDocument: function() {
      print_preview.Component.prototype.enterDocument.call(this);

      // We want to respond to mouse up events even beyond the component's
      // element.
      this.tracker.add(window, 'mouseup', this.onMouseUp_.bind(this));
      this.tracker.add(window, 'mousemove', this.onMouseMove_.bind(this));
      this.tracker.add(
          this.getElement(), 'mouseover', this.onMouseOver_.bind(this));
      this.tracker.add(
          this.getElement(), 'mouseout', this.onMouseOut_.bind(this));

      this.tracker.add(
          this.documentInfo_,
          print_preview.DocumentInfo.EventType.CHANGE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.marginsTypeTicketItem_,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.customMarginsTicketItem_,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onTicketChange_.bind(this));

      for (var orientation in this.controls_) {
        this.tracker.add(
            this.controls_[orientation],
            print_preview.MarginControl.EventType.DRAG_START,
            this.onControlDragStart_.bind(this, this.controls_[orientation]));
        this.tracker.add(
            this.controls_[orientation],
            print_preview.MarginControl.EventType.TEXT_CHANGE,
            this.onControlTextChange_.bind(this, this.controls_[orientation]));
      }
    },

    /** @override */
    decorateInternal: function() {
      for (var orientation in this.controls_) {
        this.controls_[orientation].render(this.getElement());
      }
    },

    /**
     * @param {boolean} isVisible Whether the margin controls are visible.
     * @private
     */
    setIsMarginControlsVisible_: function(isVisible) {
      for (var orientation in this.controls_) {
        this.controls_[orientation].setIsVisible(isVisible);
      }
    },

    /**
     * Moves the position of the given control to the desired position in
     * pixels within some constraint minimum and maximum.
     * @param {!print_preview.MarginControl} control Control to move.
     * @param {!print_preview.Coordinate2d} posInPixels Desired position to move
     *     to in pixels.
     * @private
     */
    moveControlWithConstraints_: function(control, posInPixels) {
      var newPosInPts;
      if (MarginControlContainer.isTopOrBottom_(control.getOrientation())) {
        newPosInPts = control.convertPixelsToPts(posInPixels.y);
      } else {
        newPosInPts = control.convertPixelsToPts(posInPixels.x);
      }
      newPosInPts = Math.min(this.customMarginsTicketItem_.getMarginMax(
                                 control.getOrientation()),
                             newPosInPts);
      newPosInPts = Math.max(0, newPosInPts);
      newPosInPts = Math.round(newPosInPts);
      control.setPositionInPts(newPosInPts);
      control.setTextboxValue(this.serializeValueFromPts_(newPosInPts));
    },

    /**
     * @param {string} value Value to parse to points. E.g. '3.40"' or '200mm'.
     * @return {number} Value in points represented by the input value.
     * @private
     */
    parseValueToPts_: function(value) {
      // Removing whitespace anywhere in the string.
      value = value.replace(/\s*/g, '');
      if (value.length == 0) {
        return null;
      }
      var validationRegex = new RegExp('^(^-?)(\\d)+(\\' +
          this.measurementSystem_.thousandsDelimeter + '\\d{3})*(\\' +
          this.measurementSystem_.decimalDelimeter + '\\d*)?' +
          '(' + this.measurementSystem_.unitSymbol + ')?$');
      if (validationRegex.test(value)) {
        // Replacing decimal point with the dot symbol in order to use
        // parseFloat() properly.
        var replacementRegex =
            new RegExp('\\' + this.measurementSystem_.decimalDelimeter + '{1}');
        value = value.replace(replacementRegex, '.');
        return this.measurementSystem_.convertToPoints(parseFloat(value));
      }
      return null;
    },

    /**
     * @param {number} value Value in points to serialize.
     * @return {string} String representation of the value in the system's local
     *     units.
     * @private
     */
    serializeValueFromPts_: function(value) {
      value = this.measurementSystem_.convertFromPoints(value);
      value = this.measurementSystem_.roundValue(value);
      return value + this.measurementSystem_.unitSymbol;
    },

    /**
     * Called when a margin control starts to drag.
     * @param {print_preview.MarginControl} control The control which started to
     *     drag.
     * @private
     */
    onControlDragStart_: function(control) {
      this.draggedControl_ = control;
      this.getElement().classList.add(
          MarginControlContainer.isTopOrBottom_(control.getOrientation()) ?
              MarginControlContainer.Classes_.DRAGGING_VERTICAL :
              MarginControlContainer.Classes_.DRAGGING_HORIZONTAL);
      this.dragChangedCallback_(true);
    },

    /**
     * Called when the mouse moves in the custom margins component. Moves the
     * dragged margin control.
     * @param {MouseEvent} event Contains the position of the mouse.
     * @private
     */
    onMouseMove_: function(event) {
      if (this.draggedControl_) {
        this.moveControlWithConstraints_(
            this.draggedControl_,
            this.draggedControl_.translateMouseToPositionInPixels(
                new print_preview.Coordinate2d(event.x, event.y)));
        this.updateClippingMask(this.clippingSize_);
      }
    },

    /**
     * Called when the mouse is released in the custom margins component.
     * Releases the dragged margin control.
     * @param {MouseEvent} event Contains the position of the mouse.
     * @private
     */
    onMouseUp_: function(event) {
      if (this.draggedControl_) {
        this.getElement().classList.remove(
            MarginControlContainer.Classes_.DRAGGING_VERTICAL);
        this.getElement().classList.remove(
            MarginControlContainer.Classes_.DRAGGING_HORIZONTAL);
        if (event) {
          var posInPixels =
              this.draggedControl_.translateMouseToPositionInPixels(
                  new print_preview.Coordinate2d(event.x, event.y));
          this.moveControlWithConstraints_(this.draggedControl_, posInPixels);
        }
        this.updateClippingMask(this.clippingSize_);
        this.customMarginsTicketItem_.updateMargin(
            this.draggedControl_.getOrientation(),
            this.draggedControl_.getPositionInPts());
        this.draggedControl_ = null;
        this.dragChangedCallback_(false);
      }
    },

    /**
     * Called when the mouse moves onto the component. Shows the margin
     * controls.
     * @private
     */
    onMouseOver_: function() {
      var fromElement = event.fromElement;
      while (fromElement != null) {
        if (fromElement == this.getElement()) {
          return;
        }
        fromElement = fromElement.parentElement;
      }
      if (this.marginsTypeTicketItem_.isCapabilityAvailable() &&
          this.marginsTypeTicketItem_.getValue() ==
              print_preview.ticket_items.MarginsType.Value.CUSTOM) {
        this.setIsMarginControlsVisible_(true);
      }
    },

    /**
     * Called when the mouse moves off of the component. Hides the margin
     * controls.
     * @private
     */
    onMouseOut_: function(event) {
      var toElement = event.toElement;
      while (toElement != null) {
        if (toElement == this.getElement()) {
          return;
        }
        toElement = toElement.parentElement;
      }
      if (this.draggedControl_ != null) {
        return;
      }
      for (var orientation in this.controls_) {
        if (this.controls_[orientation].getIsFocused() ||
            this.controls_[orientation].getIsInError()) {
          return;
        }
      }
      this.setIsMarginControlsVisible_(false);
    },

    /**
     * Called when the print ticket changes. Updates the position of the margin
     * controls.
     * @private
     */
    onTicketChange_: function() {
      var margins = this.customMarginsTicketItem_.getValue();
      for (var orientation in this.controls_) {
        var control = this.controls_[orientation];
        control.setPageSize(this.documentInfo_.pageSize);
        control.setTextboxValue(
            this.serializeValueFromPts_(margins.get(orientation)));
        control.setPositionInPts(margins.get(orientation));
        control.setIsInError(false);
        control.setIsEnabled(true);
      }
      this.updateClippingMask(this.clippingSize_);
      if (this.marginsTypeTicketItem_.getValue() !=
          print_preview.ticket_items.MarginsType.Value.CUSTOM) {
        this.setIsMarginControlsVisible_(false);
      }
    },

    /**
     * Called when the text in a textbox of a margin control changes or the
     * textbox loses focus.
     * Updates the print ticket store.
     * @param {!print_preview.MarginControl} control Updated control.
     * @private
     */
    onControlTextChange_: function(control) {
      var marginValue = this.parseValueToPts_(control.getTextboxValue());
      if (marginValue != null) {
        this.customMarginsTicketItem_.updateMargin(
            control.getOrientation(), marginValue);
        // Enable all controls.
        for (var o in this.controls_) {
          this.controls_[o].setIsEnabled(true);
        }
        control.setIsInError(false);
      } else {
        var enableOtherControls;
        if (!control.getIsFocused()) {
          // If control no longer in focus, revert to previous valid value.
          control.setTextboxValue(
              this.serializeValueFromPts_(control.getPositionInPts()));
          control.setIsInError(false);
          enableOtherControls = true;
        } else {
          control.setIsInError(true);
          enableOtherControls = false;
        }
        // Enable other controls.
        for (var o in this.controls_) {
          if (control.getOrientation() != o) {
            this.controls_[o].setIsEnabled(enableOtherControls);
          }
        }
      }
    }
  };

  // Export
  return {
    MarginControlContainer: MarginControlContainer
  };
});

// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Turn a dictionary received from postMessage into a key event.
 * @param {Object} dict A dictionary representing the key event.
 * @return {Event} A key event.
 */
function DeserializeKeyEvent(dict) {
  var e = document.createEvent('Event');
  e.initEvent('keydown');
  e.keyCode = dict.keyCode;
  e.shiftKey = dict.shiftKey;
  e.ctrlKey = dict.ctrlKey;
  e.altKey = dict.altKey;
  e.metaKey = dict.metaKey;
  e.fromScriptingAPI = true;
  return e;
}

/**
 * Turn a key event into a dictionary which can be sent over postMessage.
 * @param {Event} event A key event.
 * @return {Object} A dictionary representing the key event.
 */
function SerializeKeyEvent(event) {
  return {
    keyCode: event.keyCode,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    metaKey: event.metaKey
  };
}

/**
 * An enum containing a value specifying whether the PDF is currently loading,
 * has finished loading or failed to load.
 */
var LoadState = {
  LOADING: 'loading',
  SUCCESS: 'success',
  FAILED: 'failed'
};

/**
 * Create a new PDFScriptingAPI. This provides a scripting interface to
 * the PDF viewer so that it can be customized by things like print preview.
 * @param {Window} window the window of the page containing the pdf viewer.
 * @param {Object} plugin the plugin element containing the pdf viewer.
 */
function PDFScriptingAPI(window, plugin) {
  this.loadState_ = LoadState.LOADING;
  this.pendingScriptingMessages_ = [];
  this.setPlugin(plugin);

  window.addEventListener('message', function(event) {
    if (event.origin != 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai' &&
        event.origin != 'chrome://print') {
      console.error('Received message that was not from the extension: ' +
                    event);
      return;
    }
    switch (event.data.type) {
      case 'viewport':
        if (this.viewportChangedCallback_)
          this.viewportChangedCallback_(event.data.pageX,
                                        event.data.pageY,
                                        event.data.pageWidth,
                                        event.data.viewportWidth,
                                        event.data.viewportHeight);
        break;
      case 'documentLoaded':
        this.loadState_ = event.data.load_state;
        if (this.loadCallback_)
          this.loadCallback_(this.loadState_ == LoadState.SUCCESS);
        break;
      case 'getSelectedTextReply':
        if (this.selectedTextCallback_) {
          this.selectedTextCallback_(event.data.selectedText);
          this.selectedTextCallback_ = null;
        }
        break;
      case 'sendKeyEvent':
        if (this.keyEventCallback_)
          this.keyEventCallback_(DeserializeKeyEvent(event.data.keyEvent));
        break;
    }
  }.bind(this), false);
}

PDFScriptingAPI.prototype = {
  /**
   * @private
   * Send a message to the extension. If messages try to get sent before there
   * is a plugin element set, then we queue them up and send them later (this
   * can happen in print preview).
   * @param {Object} message The message to send.
   */
  sendMessage_: function(message) {
    if (this.plugin_)
      this.plugin_.postMessage(message, '*');
    else
      this.pendingScriptingMessages_.push(message);
  },

 /**
  * Sets the plugin element containing the PDF viewer. The element will usually
  * be passed into the PDFScriptingAPI constructor but may also be set later.
  * @param {Object} plugin the plugin element containing the PDF viewer.
  */
  setPlugin: function(plugin) {
    this.plugin_ = plugin;

    if (this.plugin_) {
      // Send a message to ensure the postMessage channel is initialized which
      // allows us to receive messages.
      this.sendMessage_({
        type: 'initialize'
      });
      // Flush pending messages.
      while (this.pendingScriptingMessages_.length > 0)
        this.sendMessage_(this.pendingScriptingMessages_.shift());
    }
  },

  /**
   * Sets the callback which will be run when the PDF viewport changes.
   * @param {Function} callback the callback to be called.
   */
  setViewportChangedCallback: function(callback) {
    this.viewportChangedCallback_ = callback;
  },

  /**
   * Sets the callback which will be run when the PDF document has finished
   * loading. If the document is already loaded, it will be run immediately.
   * @param {Function} callback the callback to be called.
   */
  setLoadCallback: function(callback) {
    this.loadCallback_ = callback;
    if (this.loadState_ != LoadState.LOADING && this.loadCallback_)
      this.loadCallback_(this.loadState_ == LoadState.SUCCESS);
  },

  /**
   * Sets a callback that gets run when a key event is fired in the PDF viewer.
   * @param {Function} callback the callback to be called with a key event.
   */
  setKeyEventCallback: function(callback) {
    this.keyEventCallback_ = callback;
  },

  /**
   * Resets the PDF viewer into print preview mode.
   * @param {string} url the url of the PDF to load.
   * @param {boolean} grayscale whether or not to display the PDF in grayscale.
   * @param {Array<number>} pageNumbers an array of the page numbers.
   * @param {boolean} modifiable whether or not the document is modifiable.
   */
  resetPrintPreviewMode: function(url, grayscale, pageNumbers, modifiable) {
    this.loadState_ = LoadState.LOADING;
    this.sendMessage_({
      type: 'resetPrintPreviewMode',
      url: url,
      grayscale: grayscale,
      pageNumbers: pageNumbers,
      modifiable: modifiable
    });
  },

  /**
   * Load a page into the document while in print preview mode.
   * @param {string} url the url of the pdf page to load.
   * @param {number} index the index of the page to load.
   */
  loadPreviewPage: function(url, index) {
    this.sendMessage_({
      type: 'loadPreviewPage',
      url: url,
      index: index
    });
  },

  /**
   * Select all the text in the document. May only be called after document
   * load.
   */
  selectAll: function() {
    this.sendMessage_({
      type: 'selectAll'
    });
  },

  /**
   * Get the selected text in the document. The callback will be called with the
   * text that is selected. May only be called after document load.
   * @param {Function} callback a callback to be called with the selected text.
   * @return {boolean} true if the function is successful, false if there is an
   *     outstanding request for selected text that has not been answered.
   */
  getSelectedText: function(callback) {
    if (this.selectedTextCallback_)
      return false;
    this.selectedTextCallback_ = callback;
    this.sendMessage_({
      type: 'getSelectedText'
    });
    return true;
  },

  /**
   * Print the document. May only be called after document load.
   */
  print: function() {
    this.sendMessage_({
      type: 'print'
    });
  },

  /**
   * Send a key event to the extension.
   * @param {Event} keyEvent the key event to send to the extension.
   */
  sendKeyEvent: function(keyEvent) {
    this.sendMessage_({
      type: 'sendKeyEvent',
      keyEvent: SerializeKeyEvent(keyEvent)
    });
  },
};

/**
 * Creates a PDF viewer with a scripting interface. This is basically 1) an
 * iframe which is navigated to the PDF viewer extension and 2) a scripting
 * interface which provides access to various features of the viewer for use
 * by print preview and accessibility.
 * @param {string} src the source URL of the PDF to load initially.
 * @return {HTMLIFrameElement} the iframe element containing the PDF viewer.
 */
function PDFCreateOutOfProcessPlugin(src) {
  var client = new PDFScriptingAPI(window);
  var iframe = window.document.createElement('iframe');
  iframe.setAttribute('src', 'pdf_preview.html?' + src);
  // Prevent the frame from being tab-focusable.
  iframe.setAttribute('tabindex', '-1');

  iframe.onload = function() {
    client.setPlugin(iframe.contentWindow);
  };

  // Add the functions to the iframe so that they can be called directly.
  iframe.setViewportChangedCallback =
      client.setViewportChangedCallback.bind(client);
  iframe.setLoadCallback = client.setLoadCallback.bind(client);
  iframe.setKeyEventCallback = client.setKeyEventCallback.bind(client);
  iframe.resetPrintPreviewMode = client.resetPrintPreviewMode.bind(client);
  iframe.loadPreviewPage = client.loadPreviewPage.bind(client);
  iframe.sendKeyEvent = client.sendKeyEvent.bind(client);
  return iframe;
}

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @typedef {{accessibility: Function,
 *            documentLoadComplete: Function,
 *            getHeight: Function,
 *            getHorizontalScrollbarThickness: Function,
 *            getPageLocationNormalized: Function,
 *            getVerticalScrollbarThickness: Function,
 *            getWidth: Function,
 *            getZoomLevel: Function,
 *            goToPage: Function,
 *            grayscale: Function,
 *            loadPreviewPage: Function,
 *            onload: Function,
 *            onPluginSizeChanged: Function,
 *            onScroll: Function,
 *            pageXOffset: Function,
 *            pageYOffset: Function,
 *            printPreviewPageCount: Function,
 *            reload: Function,
 *            removePrintButton: Function,
 *            resetPrintPreviewUrl: Function,
 *            sendKeyEvent: Function,
 *            setPageNumbers: Function,
 *            setPageXOffset: Function,
 *            setPageYOffset: Function,
 *            setZoomLevel: Function,
 *            fitToHeight: Function,
 *            fitToWidth: Function,
 *            zoomIn: Function,
 *            zoomOut: Function}}
 */
print_preview.PDFPlugin;

cr.define('print_preview', function() {
  'use strict';

  /**
   * Creates a PreviewArea object. It represents the area where the preview
   * document is displayed.
   * @param {!print_preview.DestinationStore} destinationStore Used to get the
   *     currently selected destination.
   * @param {!print_preview.PrintTicketStore} printTicketStore Used to get
   *     information about how the preview should be displayed.
   * @param {!print_preview.NativeLayer} nativeLayer Needed to communicate with
   *     Chromium's preview generation system.
   * @param {!print_preview.DocumentInfo} documentInfo Document data model.
   * @constructor
   * @extends {print_preview.Component}
   */
  function PreviewArea(
      destinationStore, printTicketStore, nativeLayer, documentInfo) {
    print_preview.Component.call(this);
    // TODO(rltoscano): Understand the dependencies of printTicketStore needed
    // here, and add only those here (not the entire print ticket store).

    /**
     * Used to get the currently selected destination.
     * @type {!print_preview.DestinationStore}
     * @private
     */
    this.destinationStore_ = destinationStore;

    /**
     * Used to get information about how the preview should be displayed.
     * @type {!print_preview.PrintTicketStore}
     * @private
     */
    this.printTicketStore_ = printTicketStore;

    /**
     * Used to contruct the preview generator.
     * @type {!print_preview.NativeLayer}
     * @private
     */
    this.nativeLayer_ = nativeLayer;

    /**
     * Document data model.
     * @type {!print_preview.DocumentInfo}
     * @private
     */
    this.documentInfo_ = documentInfo;

    /**
     * Used to read generated page previews.
     * @type {print_preview.PreviewGenerator}
     * @private
     */
    this.previewGenerator_ = null;

    /**
     * The embedded pdf plugin object. It's value is null if not yet loaded.
     * @type {HTMLEmbedElement|print_preview.PDFPlugin}
     * @private
     */
    this.plugin_ = null;

    /**
     * Custom margins component superimposed on the preview plugin.
     * @type {!print_preview.MarginControlContainer}
     * @private
     */
    this.marginControlContainer_ = new print_preview.MarginControlContainer(
        this.documentInfo_,
        this.printTicketStore_.marginsType,
        this.printTicketStore_.customMargins,
        this.printTicketStore_.measurementSystem,
        this.onMarginDragChanged_.bind(this));
    this.addChild(this.marginControlContainer_);

    /**
     * Current zoom level as a percentage.
     * @type {?number}
     * @private
     */
    this.zoomLevel_ = null;

    /**
     * Current page offset which can be used to calculate scroll amount.
     * @type {print_preview.Coordinate2d}
     * @private
     */
    this.pageOffset_ = null;

    /**
     * Whether the plugin has finished reloading.
     * @type {boolean}
     * @private
     */
    this.isPluginReloaded_ = false;

    /**
     * Whether the document preview is ready.
     * @type {boolean}
     * @private
     */
    this.isDocumentReady_ = false;

    /**
     * Timeout object used to display a loading message if the preview is taking
     * a long time to generate.
     * @type {?number}
     * @private
     */
    this.loadingTimeout_ = null;

    /**
     * Overlay element.
     * @type {HTMLElement}
     * @private
     */
    this.overlayEl_ = null;

    /**
     * The "Open system dialog" button.
     * @type {HTMLButtonElement}
     * @private
     */
    this.openSystemDialogButton_ = null;
  };

  /**
   * Event types dispatched by the preview area.
   * @enum {string}
   */
  PreviewArea.EventType = {
    // Dispatched when the "Open system dialog" button is clicked.
    OPEN_SYSTEM_DIALOG_CLICK:
        'print_preview.PreviewArea.OPEN_SYSTEM_DIALOG_CLICK',

    // Dispatched when the document preview is complete.
    PREVIEW_GENERATION_DONE:
        'print_preview.PreviewArea.PREVIEW_GENERATION_DONE',

    // Dispatched when the document preview failed to be generated.
    PREVIEW_GENERATION_FAIL:
        'print_preview.PreviewArea.PREVIEW_GENERATION_FAIL',

    // Dispatched when a new document preview is being generated.
    PREVIEW_GENERATION_IN_PROGRESS:
        'print_preview.PreviewArea.PREVIEW_GENERATION_IN_PROGRESS'
  };

  /**
   * CSS classes used by the preview area.
   * @enum {string}
   * @private
   */
  PreviewArea.Classes_ = {
    OUT_OF_PROCESS_COMPATIBILITY_OBJECT:
        'preview-area-compatibility-object-out-of-process',
    CUSTOM_MESSAGE_TEXT: 'preview-area-custom-message-text',
    MESSAGE: 'preview-area-message',
    INVISIBLE: 'invisible',
    OPEN_SYSTEM_DIALOG_BUTTON: 'preview-area-open-system-dialog-button',
    OPEN_SYSTEM_DIALOG_BUTTON_THROBBER:
        'preview-area-open-system-dialog-button-throbber',
    OVERLAY: 'preview-area-overlay-layer',
    MARGIN_CONTROL: 'margin-control',
    PREVIEW_AREA: 'preview-area-plugin-wrapper'
  };

  /**
   * Enumeration of IDs shown in the preview area.
   * @enum {string}
   * @private
   */
  PreviewArea.MessageId_ = {
    CUSTOM: 'custom',
    LOADING: 'loading',
    PREVIEW_FAILED: 'preview-failed'
  };

  /**
   * Maps message IDs to the CSS class that contains them.
   * @type {Object<print_preview.PreviewArea.MessageId_, string>}
   * @private
   */
  PreviewArea.MessageIdClassMap_ = {};
  PreviewArea.MessageIdClassMap_[PreviewArea.MessageId_.CUSTOM] =
      'preview-area-custom-message';
  PreviewArea.MessageIdClassMap_[PreviewArea.MessageId_.LOADING] =
      'preview-area-loading-message';
  PreviewArea.MessageIdClassMap_[PreviewArea.MessageId_.PREVIEW_FAILED] =
      'preview-area-preview-failed-message';

  /**
   * Amount of time in milliseconds to wait after issueing a new preview before
   * the loading message is shown.
   * @type {number}
   * @const
   * @private
   */
  PreviewArea.LOADING_TIMEOUT_ = 200;

  PreviewArea.prototype = {
    __proto__: print_preview.Component.prototype,

    /**
     * Should only be called after calling this.render().
     * @return {boolean} Whether the preview area has a compatible plugin to
     *     display the print preview in.
     */
    get hasCompatiblePlugin() {
      return this.previewGenerator_ != null;
    },

    /**
     * Processes a keyboard event that could possibly be used to change state of
     * the preview plugin.
     * @param {KeyboardEvent} e Keyboard event to process.
     */
    handleDirectionalKeyEvent: function(e) {
      // Make sure the PDF plugin is there.
      // We only care about: PageUp, PageDown, Left, Up, Right, Down.
      // If the user is holding a modifier key, ignore.
      if (!this.plugin_ ||
          !arrayContains([33, 34, 37, 38, 39, 40], e.keyCode) ||
          e.metaKey || e.altKey || e.shiftKey || e.ctrlKey) {
        return;
      }

      // Don't handle the key event for these elements.
      var tagName = document.activeElement.tagName;
      if (arrayContains(['INPUT', 'SELECT', 'EMBED'], tagName)) {
        return;
      }

      // For the most part, if any div of header was the last clicked element,
      // then the active element is the body. Starting with the last clicked
      // element, and work up the DOM tree to see if any element has a
      // scrollbar. If there exists a scrollbar, do not handle the key event
      // here.
      var element = e.target;
      while (element) {
        if (element.scrollHeight > element.clientHeight ||
            element.scrollWidth > element.clientWidth) {
          return;
        }
        element = element.parentElement;
      }

      // No scroll bar anywhere, or the active element is something else, like a
      // button. Note: buttons have a bigger scrollHeight than clientHeight.
      this.plugin_.sendKeyEvent(e);
      e.preventDefault();
    },

    /**
     * Set a callback that gets called when a key event is received that
     * originates in the plugin.
     * @param {function(Event)} callback The callback to be called with a key
     *     event.
     */
    setPluginKeyEventCallback: function(callback) {
      this.keyEventCallback_ = callback;
    },

    /**
     * Shows a custom message on the preview area's overlay.
     * @param {string} message Custom message to show.
     */
    showCustomMessage: function(message) {
      this.showMessage_(PreviewArea.MessageId_.CUSTOM, message);
    },

    /** @override */
    enterDocument: function() {
      print_preview.Component.prototype.enterDocument.call(this);
      this.tracker.add(
          assert(this.openSystemDialogButton_),
          'click',
          this.onOpenSystemDialogButtonClick_.bind(this));

      this.tracker.add(
          this.printTicketStore_,
          print_preview.PrintTicketStore.EventType.INITIALIZE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.printTicketStore_,
          print_preview.PrintTicketStore.EventType.TICKET_CHANGE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.printTicketStore_,
          print_preview.PrintTicketStore.EventType.CAPABILITIES_CHANGE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.printTicketStore_,
          print_preview.PrintTicketStore.EventType.DOCUMENT_CHANGE,
          this.onTicketChange_.bind(this));

      this.tracker.add(
          this.printTicketStore_.color,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.printTicketStore_.cssBackground,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
        this.printTicketStore_.customMargins,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.printTicketStore_.fitToPage,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.printTicketStore_.headerFooter,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.printTicketStore_.landscape,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.printTicketStore_.marginsType,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.printTicketStore_.pageRange,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onTicketChange_.bind(this));
      this.tracker.add(
          this.printTicketStore_.selectionOnly,
          print_preview.ticket_items.TicketItem.EventType.CHANGE,
          this.onTicketChange_.bind(this));

      if (this.checkPluginCompatibility_()) {
        this.previewGenerator_ = new print_preview.PreviewGenerator(
            this.destinationStore_,
            this.printTicketStore_,
            this.nativeLayer_,
            this.documentInfo_);
        this.tracker.add(
            this.previewGenerator_,
            print_preview.PreviewGenerator.EventType.PREVIEW_START,
            this.onPreviewStart_.bind(this));
        this.tracker.add(
            this.previewGenerator_,
            print_preview.PreviewGenerator.EventType.PAGE_READY,
            this.onPagePreviewReady_.bind(this));
        this.tracker.add(
            this.previewGenerator_,
            print_preview.PreviewGenerator.EventType.FAIL,
            this.onPreviewGenerationFail_.bind(this));
        this.tracker.add(
            this.previewGenerator_,
            print_preview.PreviewGenerator.EventType.DOCUMENT_READY,
            this.onDocumentReady_.bind(this));
      } else {
        this.showCustomMessage(loadTimeData.getString('noPlugin'));
      }
    },

    /** @override */
    exitDocument: function() {
      print_preview.Component.prototype.exitDocument.call(this);
      if (this.previewGenerator_) {
        this.previewGenerator_.removeEventListeners();
      }
      this.overlayEl_ = null;
      this.openSystemDialogButton_ = null;
    },

    /** @override */
    decorateInternal: function() {
      this.marginControlContainer_.decorate(this.getElement());
      this.overlayEl_ = this.getElement().getElementsByClassName(
          PreviewArea.Classes_.OVERLAY)[0];
      this.openSystemDialogButton_ = this.getElement().getElementsByClassName(
          PreviewArea.Classes_.OPEN_SYSTEM_DIALOG_BUTTON)[0];
    },

    /**
     * Checks to see if a suitable plugin for rendering the preview exists. If
     * one does not exist, then an error message will be displayed.
     * @return {boolean} true if Chromium has a plugin for rendering the
     *     the preview.
     * @private
     */
    checkPluginCompatibility_: function() {
      // TODO(raymes): It's harder to test compatibility of the out of process
      // plugin because it's asynchronous. We could do a better job at some
      // point.
      var oopCompatObj = this.getElement().getElementsByClassName(
          PreviewArea.Classes_.OUT_OF_PROCESS_COMPATIBILITY_OBJECT)[0];
      var isOOPCompatible = oopCompatObj.postMessage;
      oopCompatObj.parentElement.removeChild(oopCompatObj);

      return isOOPCompatible;
    },

    /**
     * Shows a given message on the overlay.
     * @param {!print_preview.PreviewArea.MessageId_} messageId ID of the
     *     message to show.
     * @param {string=} opt_message Optional message to show that can be used
     *     by some message IDs.
     * @private
     */
    showMessage_: function(messageId, opt_message) {
      // Hide all messages.
      var messageEls = this.getElement().getElementsByClassName(
          PreviewArea.Classes_.MESSAGE);
      for (var i = 0, messageEl; messageEl = messageEls[i]; i++) {
        setIsVisible(messageEl, false);
      }
      // Disable jumping animation to conserve cycles.
      var jumpingDotsEl = this.getElement().querySelector(
          '.preview-area-loading-message-jumping-dots');
      jumpingDotsEl.classList.remove('jumping-dots');

      // Show specific message.
      if (messageId == PreviewArea.MessageId_.CUSTOM) {
        var customMessageTextEl = this.getElement().getElementsByClassName(
            PreviewArea.Classes_.CUSTOM_MESSAGE_TEXT)[0];
        customMessageTextEl.textContent = opt_message;
      } else if (messageId == PreviewArea.MessageId_.LOADING) {
        jumpingDotsEl.classList.add('jumping-dots');
      }
      var messageEl = this.getElement().getElementsByClassName(
            PreviewArea.MessageIdClassMap_[messageId])[0];
      setIsVisible(messageEl, true);

      this.setOverlayVisible_(true);
    },

    /**
     * Set the visibility of the message overlay.
     * @param {boolean} visible Whether to make the overlay visible or not
     * @private
     */
    setOverlayVisible_: function(visible) {
      this.overlayEl_.classList.toggle(
          PreviewArea.Classes_.INVISIBLE,
          !visible);
      this.overlayEl_.setAttribute('aria-hidden', !visible);

      // Hide/show all controls that will overlap when the overlay is visible.
      var marginControls = this.getElement().getElementsByClassName(
          PreviewArea.Classes_.MARGIN_CONTROL);
      for (var i = 0; i < marginControls.length; ++i) {
        marginControls[i].setAttribute('aria-hidden', visible);
      }
      var previewAreaControls = this.getElement().getElementsByClassName(
          PreviewArea.Classes_.PREVIEW_AREA);
      for (var i = 0; i < previewAreaControls.length; ++i) {
        previewAreaControls[i].setAttribute('aria-hidden', visible);
      }

      if (!visible) {
        // Disable jumping animation to conserve cycles.
        var jumpingDotsEl = this.getElement().querySelector(
            '.preview-area-loading-message-jumping-dots');
        jumpingDotsEl.classList.remove('jumping-dots');
      }
    },

    /**
     * Creates a preview plugin and adds it to the DOM.
     * @param {string} srcUrl Initial URL of the plugin.
     * @private
     */
    createPlugin_: function(srcUrl) {
      if (this.plugin_) {
        console.warn('Pdf preview plugin already created');
        return;
      }

      this.plugin_ = /** @type {print_preview.PDFPlugin} */(
          PDFCreateOutOfProcessPlugin(srcUrl));
      this.plugin_.setKeyEventCallback(this.keyEventCallback_);

      this.plugin_.setAttribute('class', 'preview-area-plugin');
      this.plugin_.setAttribute('aria-live', 'polite');
      this.plugin_.setAttribute('aria-atomic', 'true');
      // NOTE: The plugin's 'id' field must be set to 'pdf-viewer' since
      // chrome/renderer/printing/print_web_view_helper.cc actually references
      // it.
      this.plugin_.setAttribute('id', 'pdf-viewer');
      this.getChildElement('.preview-area-plugin-wrapper').
          appendChild(/** @type {Node} */(this.plugin_));


      var pageNumbers =
          this.printTicketStore_.pageRange.getPageNumberSet().asArray();
      var grayscale = !this.printTicketStore_.color.getValue();
      this.plugin_.setLoadCallback(this.onPluginLoad_.bind(this));
      this.plugin_.setViewportChangedCallback(
          this.onPreviewVisualStateChange_.bind(this));
      this.plugin_.resetPrintPreviewMode(srcUrl, grayscale, pageNumbers,
                                         this.documentInfo_.isModifiable);
    },

    /**
     * Dispatches a PREVIEW_GENERATION_DONE event if all conditions are met.
     * @private
     */
    dispatchPreviewGenerationDoneIfReady_: function() {
      if (this.isDocumentReady_ && this.isPluginReloaded_) {
        cr.dispatchSimpleEvent(
            this, PreviewArea.EventType.PREVIEW_GENERATION_DONE);
        this.marginControlContainer_.showMarginControlsIfNeeded();
      }
    },

    /**
     * Called when the open-system-dialog button is clicked. Disables the
     * button, shows the throbber, and dispatches the OPEN_SYSTEM_DIALOG_CLICK
     * event.
     * @private
     */
    onOpenSystemDialogButtonClick_: function() {
      this.openSystemDialogButton_.disabled = true;
      var openSystemDialogThrobber = this.getElement().getElementsByClassName(
          PreviewArea.Classes_.OPEN_SYSTEM_DIALOG_BUTTON_THROBBER)[0];
      setIsVisible(openSystemDialogThrobber, true);
      cr.dispatchSimpleEvent(
          this, PreviewArea.EventType.OPEN_SYSTEM_DIALOG_CLICK);
    },

    /**
     * Called when the print ticket changes. Updates the preview.
     * @private
     */
    onTicketChange_: function() {
      if (this.previewGenerator_ && this.previewGenerator_.requestPreview()) {
        cr.dispatchSimpleEvent(
            this, PreviewArea.EventType.PREVIEW_GENERATION_IN_PROGRESS);
        if (this.loadingTimeout_ == null) {
          this.loadingTimeout_ = setTimeout(
              this.showMessage_.bind(this, PreviewArea.MessageId_.LOADING),
              PreviewArea.LOADING_TIMEOUT_);
        }
      } else {
        this.marginControlContainer_.showMarginControlsIfNeeded();
      }
    },

    /**
     * Called when the preview generator begins loading the preview.
     * @param {Event} event Contains the URL to initialize the plugin to.
     * @private
     */
    onPreviewStart_: function(event) {
      this.isDocumentReady_ = false;
      this.isPluginReloaded_ = false;
      if (!this.plugin_) {
        this.createPlugin_(event.previewUrl);
      } else {
        var grayscale = !this.printTicketStore_.color.getValue();
        var pageNumbers =
            this.printTicketStore_.pageRange.getPageNumberSet().asArray();
        var url = event.previewUrl;
        this.plugin_.resetPrintPreviewMode(url, grayscale, pageNumbers,
                                           this.documentInfo_.isModifiable);
      }
      cr.dispatchSimpleEvent(
          this, PreviewArea.EventType.PREVIEW_GENERATION_IN_PROGRESS);
    },

    /**
     * Called when a page preview has been generated. Updates the plugin with
     * the new page.
     * @param {Event} event Contains information about the page preview.
     * @private
     */
    onPagePreviewReady_: function(event) {
      this.plugin_.loadPreviewPage(event.previewUrl, event.previewIndex);
    },

    /**
     * Called when the preview generation is complete and the document is ready
     * to print.
     * @private
     */
    onDocumentReady_: function(event) {
      this.isDocumentReady_ = true;
      this.dispatchPreviewGenerationDoneIfReady_();
    },

    /**
     * Called when the generation of a preview fails. Shows an error message.
     * @private
     */
    onPreviewGenerationFail_: function() {
      if (this.loadingTimeout_) {
        clearTimeout(this.loadingTimeout_);
        this.loadingTimeout_ = null;
      }
      this.showMessage_(PreviewArea.MessageId_.PREVIEW_FAILED);
      cr.dispatchSimpleEvent(
          this, PreviewArea.EventType.PREVIEW_GENERATION_FAIL);
    },

    /**
     * Called when the plugin loads. This is a consequence of calling
     * plugin.reload(). Certain plugin state can only be set after the plugin
     * has loaded.
     * @private
     */
    onPluginLoad_: function() {
      if (this.loadingTimeout_) {
        clearTimeout(this.loadingTimeout_);
        this.loadingTimeout_ = null;
      }

      this.setOverlayVisible_(false);
      this.isPluginReloaded_ = true;
      this.dispatchPreviewGenerationDoneIfReady_();
    },

    /**
     * Called when the preview plugin's visual state has changed. This is a
     * consequence of scrolling or zooming the plugin. Updates the custom
     * margins component if shown.
     * @private
     */
    onPreviewVisualStateChange_: function(pageX,
                                          pageY,
                                          pageWidth,
                                          viewportWidth,
                                          viewportHeight) {
      this.marginControlContainer_.updateTranslationTransform(
          new print_preview.Coordinate2d(pageX, pageY));
      this.marginControlContainer_.updateScaleTransform(
          pageWidth / this.documentInfo_.pageSize.width);
      this.marginControlContainer_.updateClippingMask(
          new print_preview.Size(viewportWidth, viewportHeight));
    },

    /**
     * Called when dragging margins starts or stops.
     * @param {boolean} isDragging True if the margin is currently being dragged
     *     and false otherwise.
     */
    onMarginDragChanged_: function(isDragging) {
      if (!this.plugin_)
        return;

      // When hovering over the plugin (which may be in a separate iframe)
      // pointer events will be sent to the frame. When dragging the margins,
      // we don't want this to happen as it can cause the margin to stop
      // being draggable.
      this.plugin_.style.pointerEvents = isDragging ? 'none' : 'auto';
    }
  };

  // Export
  return {
    PreviewArea: PreviewArea
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Interface to the Chromium print preview generator.
   * @param {!print_preview.DestinationStore} destinationStore Used to get the
   *     currently selected destination.
   * @param {!print_preview.PrintTicketStore} printTicketStore Used to read the
   *     state of the ticket and write document information.
   * @param {!print_preview.NativeLayer} nativeLayer Used to communicate to
   *     Chromium's preview rendering system.
   * @param {!print_preview.DocumentInfo} documentInfo Document data model.
   * @constructor
   * @extends {cr.EventTarget}
   */
  function PreviewGenerator(
       destinationStore, printTicketStore, nativeLayer, documentInfo) {
    cr.EventTarget.call(this);

    /**
     * Used to get the currently selected destination.
     * @type {!print_preview.DestinationStore}
     * @private
     */
    this.destinationStore_ = destinationStore;

    /**
     * Used to read the state of the ticket and write document information.
     * @type {!print_preview.PrintTicketStore}
     * @private
     */
    this.printTicketStore_ = printTicketStore;

    /**
     * Interface to the Chromium native layer.
     * @type {!print_preview.NativeLayer}
     * @private
     */
    this.nativeLayer_ = nativeLayer;

    /**
     * Document data model.
     * @type {!print_preview.DocumentInfo}
     * @private
     */
    this.documentInfo_ = documentInfo;

    /**
     * ID of current in-flight request. Requests that do not share this ID will
     * be ignored.
     * @type {number}
     * @private
     */
    this.inFlightRequestId_ = -1;

    /**
     * Media size to generate preview with. {@code null} indicates default size.
     * @type {cp.cdd.MediaSizeTicketItem}
     * @private
     */
    this.mediaSize_ = null;

    /**
     * Whether the previews are being generated in landscape mode.
     * @type {boolean}
     * @private
     */
    this.isLandscapeEnabled_ = false;

    /**
     * Whether the previews are being generated with a header and footer.
     * @type {boolean}
     * @private
     */
    this.isHeaderFooterEnabled_ = false;

    /**
     * Whether the previews are being generated in color.
     * @type {boolean}
     * @private
     */
    this.colorValue_ = false;

    /**
     * Whether the document should be fitted to the page.
     * @type {boolean}
     * @private
     */
    this.isFitToPageEnabled_ = false;

    /**
     * Page ranges setting used used to generate the last preview.
     * @type {!Array<object<{from: number, to: number}>>}
     * @private
     */
    this.pageRanges_ = null;

    /**
     * Margins type used to generate the last preview.
     * @type {!print_preview.ticket_items.MarginsType.Value}
     * @private
     */
    this.marginsType_ = print_preview.ticket_items.MarginsType.Value.DEFAULT;

    /**
     * Whether the document should have element CSS backgrounds printed.
     * @type {boolean}
     * @private
     */
    this.isCssBackgroundEnabled_ = false;

    /**
     * Destination that was selected for the last preview.
     * @type {print_preview.Destination}
     * @private
     */
    this.selectedDestination_ = null;

    /**
     * Event tracker used to keep track of native layer events.
     * @type {!EventTracker}
     * @private
     */
    this.tracker_ = new EventTracker();

    this.addEventListeners_();
  };

  /**
   * Event types dispatched by the preview generator.
   * @enum {string}
   */
  PreviewGenerator.EventType = {
    // Dispatched when the document can be printed.
    DOCUMENT_READY: 'print_preview.PreviewGenerator.DOCUMENT_READY',

    // Dispatched when a page preview is ready. The previewIndex field of the
    // event is the index of the page in the modified document, not the
    // original. So page 4 of the original document might be previewIndex = 0 of
    // the modified document.
    PAGE_READY: 'print_preview.PreviewGenerator.PAGE_READY',

    // Dispatched when the document preview starts to be generated.
    PREVIEW_START: 'print_preview.PreviewGenerator.PREVIEW_START',

    // Dispatched when the current print preview request fails.
    FAIL: 'print_preview.PreviewGenerator.FAIL'
  };

  PreviewGenerator.prototype = {
    __proto__: cr.EventTarget.prototype,

    /**
     * Request that new preview be generated. A preview request will not be
     * generated if the print ticket has not changed sufficiently.
     * @return {boolean} Whether a new preview was actually requested.
     */
    requestPreview: function() {
      if (!this.printTicketStore_.isTicketValidForPreview() ||
          !this.printTicketStore_.isInitialized ||
          !this.destinationStore_.selectedDestination) {
        return false;
      }
      if (!this.hasPreviewChanged_()) {
        // Changes to these ticket items might not trigger a new preview, but
        // they still need to be recorded.
        this.marginsType_ = this.printTicketStore_.marginsType.getValue();
        return false;
      }
      this.mediaSize_ = this.printTicketStore_.mediaSize.getValue();
      this.isLandscapeEnabled_ = this.printTicketStore_.landscape.getValue();
      this.isHeaderFooterEnabled_ =
          this.printTicketStore_.headerFooter.getValue();
      this.colorValue_ = this.printTicketStore_.color.getValue();
      this.isFitToPageEnabled_ = this.printTicketStore_.fitToPage.getValue();
      this.pageRanges_ = this.printTicketStore_.pageRange.getPageRanges();
      this.marginsType_ = this.printTicketStore_.marginsType.getValue();
      this.isCssBackgroundEnabled_ =
          this.printTicketStore_.cssBackground.getValue();
      this.isSelectionOnlyEnabled_ =
          this.printTicketStore_.selectionOnly.getValue();
      this.selectedDestination_ = this.destinationStore_.selectedDestination;

      this.inFlightRequestId_++;
      this.nativeLayer_.startGetPreview(
          this.destinationStore_.selectedDestination,
          this.printTicketStore_,
          this.documentInfo_,
          this.inFlightRequestId_);
      return true;
    },

    /** Removes all event listeners that the preview generator has attached. */
    removeEventListeners: function() {
      this.tracker_.removeAll();
    },

    /**
     * Adds event listeners to the relevant native layer events.
     * @private
     */
    addEventListeners_: function() {
      this.tracker_.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.PAGE_LAYOUT_READY,
          this.onPageLayoutReady_.bind(this));
      this.tracker_.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.PAGE_COUNT_READY,
          this.onPageCountReady_.bind(this));
      this.tracker_.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.PAGE_PREVIEW_READY,
          this.onPagePreviewReady_.bind(this));
      this.tracker_.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.PREVIEW_GENERATION_DONE,
          this.onPreviewGenerationDone_.bind(this));
      this.tracker_.add(
          this.nativeLayer_,
          print_preview.NativeLayer.EventType.PREVIEW_GENERATION_FAIL,
          this.onPreviewGenerationFail_.bind(this));
    },

    /**
     * Dispatches a PAGE_READY event to signal that a page preview is ready.
     * @param {number} previewIndex Index of the page with respect to the pages
     *     shown in the preview. E.g an index of 0 is the first displayed page,
     *     but not necessarily the first original document page.
     * @param {number} pageNumber Number of the page with respect to the
     *     document. A value of 3 means it's the third page of the original
     *     document.
     * @param {number} previewUid Unique identifier of the preview.
     * @private
     */
    dispatchPageReadyEvent_: function(previewIndex, pageNumber, previewUid) {
      var pageGenEvent = new Event(PreviewGenerator.EventType.PAGE_READY);
      pageGenEvent.previewIndex = previewIndex;
      pageGenEvent.previewUrl = 'chrome://print/' + previewUid.toString() +
          '/' + (pageNumber - 1) + '/print.pdf';
      this.dispatchEvent(pageGenEvent);
    },

    /**
     * Dispatches a PREVIEW_START event. Signals that the preview should be
     * reloaded.
     * @param {number} previewUid Unique identifier of the preview.
     * @param {number} index Index of the first page of the preview.
     * @private
     */
    dispatchPreviewStartEvent_: function(previewUid, index) {
      var previewStartEvent = new Event(
          PreviewGenerator.EventType.PREVIEW_START);
      if (!this.documentInfo_.isModifiable) {
        index = -1;
      }
      previewStartEvent.previewUrl = 'chrome://print/' +
          previewUid.toString() + '/' + index + '/print.pdf';
      this.dispatchEvent(previewStartEvent);
    },

    /**
     * @return {boolean} Whether the print ticket has changed sufficiently to
     *     determine whether a new preview request should be issued.
     * @private
     */
    hasPreviewChanged_: function() {
      var ticketStore = this.printTicketStore_;
      return this.inFlightRequestId_ == -1 ||
          !ticketStore.mediaSize.isValueEqual(this.mediaSize_) ||
          !ticketStore.landscape.isValueEqual(this.isLandscapeEnabled_) ||
          !ticketStore.headerFooter.isValueEqual(this.isHeaderFooterEnabled_) ||
          !ticketStore.color.isValueEqual(this.colorValue_) ||
          !ticketStore.fitToPage.isValueEqual(this.isFitToPageEnabled_) ||
          this.pageRanges_ == null ||
          !areRangesEqual(ticketStore.pageRange.getPageRanges(),
                          this.pageRanges_) ||
          (!ticketStore.marginsType.isValueEqual(this.marginsType_) &&
              !ticketStore.marginsType.isValueEqual(
                  print_preview.ticket_items.MarginsType.Value.CUSTOM)) ||
          (ticketStore.marginsType.isValueEqual(
              print_preview.ticket_items.MarginsType.Value.CUSTOM) &&
              !ticketStore.customMargins.isValueEqual(
                  this.documentInfo_.margins)) ||
          !ticketStore.cssBackground.isValueEqual(
              this.isCssBackgroundEnabled_) ||
          !ticketStore.selectionOnly.isValueEqual(
              this.isSelectionOnlyEnabled_) ||
          (this.selectedDestination_ !=
              this.destinationStore_.selectedDestination);
    },

    /**
     * Called when the page layout of the document is ready. Always occurs
     * as a result of a preview request.
     * @param {Event} event Contains layout info about the document.
     * @private
     */
    onPageLayoutReady_: function(event) {
      // NOTE: A request ID is not specified, so assuming its for the current
      // in-flight request.

      var origin = new print_preview.Coordinate2d(
          event.pageLayout.printableAreaX,
          event.pageLayout.printableAreaY);
      var size = new print_preview.Size(
          event.pageLayout.printableAreaWidth,
          event.pageLayout.printableAreaHeight);

      var margins = new print_preview.Margins(
          Math.round(event.pageLayout.marginTop),
          Math.round(event.pageLayout.marginRight),
          Math.round(event.pageLayout.marginBottom),
          Math.round(event.pageLayout.marginLeft));

      var o = print_preview.ticket_items.CustomMargins.Orientation;
      var pageSize = new print_preview.Size(
          event.pageLayout.contentWidth +
              margins.get(o.LEFT) + margins.get(o.RIGHT),
          event.pageLayout.contentHeight +
              margins.get(o.TOP) + margins.get(o.BOTTOM));

      this.documentInfo_.updatePageInfo(
          new print_preview.PrintableArea(origin, size),
          pageSize,
          event.hasCustomPageSizeStyle,
          margins);
    },

    /**
     * Called when the document page count is received from the native layer.
     * Always occurs as a result of a preview request.
     * @param {Event} event Contains the document's page count.
     * @private
     */
    onPageCountReady_: function(event) {
      if (this.inFlightRequestId_ != event.previewResponseId) {
        return; // Ignore old response.
      }
      this.documentInfo_.updatePageCount(event.pageCount);
      this.pageRanges_ = this.printTicketStore_.pageRange.getPageRanges();
    },

    /**
     * Called when a page's preview has been generated. Dispatches a
     * PAGE_READY event.
     * @param {Event} event Contains the page index and preview UID.
     * @private
     */
    onPagePreviewReady_: function(event) {
      if (this.inFlightRequestId_ != event.previewResponseId) {
        return; // Ignore old response.
      }
      var pageNumber = event.pageIndex + 1;
      var pageNumberSet = this.printTicketStore_.pageRange.getPageNumberSet();
      if (pageNumberSet.hasPageNumber(pageNumber)) {
        var previewIndex = pageNumberSet.getPageNumberIndex(pageNumber);
        if (previewIndex == 0) {
          this.dispatchPreviewStartEvent_(event.previewUid, event.pageIndex);
        }
        this.dispatchPageReadyEvent_(
            previewIndex, pageNumber, event.previewUid);
      }
    },

    /**
     * Called when the preview generation is complete. Dispatches a
     * DOCUMENT_READY event.
     * @param {Event} event Contains the preview UID and response ID.
     * @private
     */
    onPreviewGenerationDone_: function(event) {
      if (this.inFlightRequestId_ != event.previewResponseId) {
        return; // Ignore old response.
      }
      // Dispatch a PREVIEW_START event since non-modifiable documents don't
      // trigger PAGE_READY events.
      if (!this.documentInfo_.isModifiable) {
        this.dispatchPreviewStartEvent_(event.previewUid, 0);
      }
      cr.dispatchSimpleEvent(this, PreviewGenerator.EventType.DOCUMENT_READY);
    },

    /**
     * Called when the preview generation fails.
     * @private
     */
    onPreviewGenerationFail_: function() {
      // NOTE: No request ID is returned from Chromium so its assumed its the
      // current one.
      cr.dispatchSimpleEvent(this, PreviewGenerator.EventType.FAIL);
    }
  };

  // Export
  return {
    PreviewGenerator: PreviewGenerator
  };
});


// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Component that displays a list of destinations with a heading, action link,
   * and "Show All..." button. An event is dispatched when the action link is
   * activated.
   * @param {!cr.EventTarget} eventTarget Event target to pass to destination
   *     items for dispatching SELECT events.
   * @param {string} title Title of the destination list.
   * @param {?string} actionLinkLabel Optional label of the action link. If
   *     {@code null} is provided, the action link will not be shown.
   * @param {boolean=} opt_showAll Whether to initially show all destinations or
   *     only the first few ones.
   * @constructor
   * @extends {print_preview.Component}
   */
  function DestinationList(eventTarget, title, actionLinkLabel, opt_showAll) {
    print_preview.Component.call(this);

    /**
     * Event target to pass to destination items for dispatching SELECT events.
     * @type {!cr.EventTarget}
     * @private
     */
    this.eventTarget_ = eventTarget;

    /**
     * Title of the destination list.
     * @type {string}
     * @private
     */
    this.title_ = title;

    /**
     * Label of the action link.
     * @type {?string}
     * @private
     */
    this.actionLinkLabel_ = actionLinkLabel;

    /**
     * Backing store for the destination list.
     * @type {!Array<print_preview.Destination>}
     * @private
     */
    this.destinations_ = [];

    /**
     * Set of destination ids.
     * @type {!Object<boolean>}
     * @private
     */
    this.destinationIds_ = {};

    /**
     * Current query used for filtering.
     * @type {RegExp}
     * @private
     */
    this.query_ = null;

    /**
     * Whether the destination list is fully expanded.
     * @type {boolean}
     * @private
     */
    this.isShowAll_ = opt_showAll || false;

    /**
     * Maximum number of destinations before showing the "Show All..." button.
     * @type {number}
     * @private
     */
    this.shortListSize_ = DestinationList.DEFAULT_SHORT_LIST_SIZE_;

    /**
     * List items representing destinations.
     * @type {!Array<!print_preview.DestinationListItem>}
     * @private
     */
    this.listItems_ = [];
  };

  /**
   * Enumeration of event types dispatched by the destination list.
   * @enum {string}
   */
  DestinationList.EventType = {
    // Dispatched when the action linked is activated.
    ACTION_LINK_ACTIVATED: 'print_preview.DestinationList.ACTION_LINK_ACTIVATED'
  };

  /**
   * Default maximum number of destinations before showing the "Show All..."
   * button.
   * @type {number}
   * @const
   * @private
   */
  DestinationList.DEFAULT_SHORT_LIST_SIZE_ = 4;

  /**
   * Height of a destination list item in pixels.
   * @type {number}
   * @const
   * @private
   */
  DestinationList.HEIGHT_OF_ITEM_ = 30;

  DestinationList.prototype = {
    __proto__: print_preview.Component.prototype,

    /** @param {boolean} isShowAll Whether the show-all button is activated. */
    setIsShowAll: function(isShowAll) {
      this.isShowAll_ = isShowAll;
      this.renderDestinations_();
    },

    /**
     * @return {number} Size of list when destination list is in collapsed
     *     mode (a.k.a non-show-all mode).
     */
    getShortListSize: function() {
      return this.shortListSize_;
    },

    /** @return {number} Count of the destinations in the list. */
    getDestinationsCount: function() {
      return this.destinations_.length;
    },

    /**
     * Gets estimated height of the destination list for the given number of
     * items.
     * @param {number} numItems Number of items to render in the destination
     *     list.
     * @return {number} Height (in pixels) of the destination list.
     */
    getEstimatedHeightInPixels: function(numItems) {
      numItems = Math.min(numItems, this.destinations_.length);
      var headerHeight =
          this.getChildElement('.destination-list > header').offsetHeight;
      return headerHeight + (numItems > 0 ?
          numItems * DestinationList.HEIGHT_OF_ITEM_ :
          // To account for "No destinations found" message.
          DestinationList.HEIGHT_OF_ITEM_);
    },

    /**
     * @return {Element} The element that contains this one. Used for height
     *     calculations.
     */
    getContainerElement: function() {
      return this.getElement().parentNode;
    },

    /** @param {boolean} isVisible Whether the throbber is visible. */
    setIsThrobberVisible: function(isVisible) {
      setIsVisible(this.getChildElement('.throbber-container'), isVisible);
    },

    /**
     * @param {number} size Size of list when destination list is in collapsed
     *     mode (a.k.a non-show-all mode).
     */
    updateShortListSize: function(size) {
      size = Math.max(1, Math.min(size, this.destinations_.length));
      if (size == 1 && this.destinations_.length > 1) {
        // If this is the case, we will only show the "Show All" button and
        // nothing else. Increment the short list size by one so that we can see
        // at least one print destination.
        size++;
      }
      this.setShortListSizeInternal(size);
    },

    /** @override */
    createDom: function() {
      this.setElementInternal(this.cloneTemplateInternal(
          'destination-list-template'));
      this.getChildElement('.title').textContent = this.title_;
      if (this.actionLinkLabel_) {
        var actionLinkEl = this.getChildElement('.action-link');
        actionLinkEl.textContent = this.actionLinkLabel_;
        setIsVisible(actionLinkEl, true);
      }
    },

    /** @override */
    enterDocument: function() {
      print_preview.Component.prototype.enterDocument.call(this);
      this.tracker.add(
          this.getChildElement('.action-link'),
          'click',
          this.onActionLinkClick_.bind(this));
      this.tracker.add(
          this.getChildElement('.show-all-button'),
          'click',
          this.setIsShowAll.bind(this, true));
    },

    /**
     * Updates the destinations to render in the destination list.
     * @param {!Array<print_preview.Destination>} destinations Destinations to
     *     render.
     */
    updateDestinations: function(destinations) {
      this.destinations_ = destinations;
      this.destinationIds_ = destinations.reduce(function(ids, destination) {
        ids[destination.id] = true;
        return ids;
      }, {});
      this.renderDestinations_();
    },

    /** @param {RegExp} query Query to update the filter with. */
    updateSearchQuery: function(query) {
      this.query_ = query;
      this.renderDestinations_();
    },

    /**
     * @param {string} text Text to set the action link to.
     * @protected
     */
    setActionLinkTextInternal: function(text) {
      this.actionLinkLabel_ = text;
      this.getChildElement('.action-link').textContent = text;
    },

    /**
     * Sets the short list size without constraints.
     * @protected
     */
    setShortListSizeInternal: function(size) {
      this.shortListSize_ = size;
      this.renderDestinations_();
    },

    /**
     * Renders all destinations in the list that match the current query.
     * @private
     */
    renderDestinations_: function() {
      if (!this.query_) {
        this.renderDestinationsList_(this.destinations_);
      } else {
        var filteredDests = this.destinations_.filter(function(destination) {
          return destination.matches(this.query_);
        }, this);
        this.renderDestinationsList_(filteredDests);
      }
    },

    /**
     * Renders all destinations in the given list.
     * @param {!Array<print_preview.Destination>} destinations List of
     *     destinations to render.
     * @private
     */
    renderDestinationsList_: function(destinations) {
      // Update item counters, footers and other misc controls.
      setIsVisible(this.getChildElement('.no-destinations-message'),
                   destinations.length == 0);
      setIsVisible(this.getChildElement('.destination-list > footer'), false);
      var numItems = destinations.length;
      if (destinations.length > this.shortListSize_ && !this.isShowAll_) {
        numItems = this.shortListSize_ - 1;
        this.getChildElement('.total').textContent =
            loadTimeData.getStringF('destinationCount', destinations.length);
        setIsVisible(this.getChildElement('.destination-list > footer'), true);
      }
      // Remove obsolete list items (those with no corresponding destinations).
      this.listItems_ = this.listItems_.filter(function(item) {
        var isValid = this.destinationIds_.hasOwnProperty(item.destination.id);
        if (!isValid)
          this.removeChild(item);
        return isValid;
      }.bind(this));
      // Prepare id -> list item cache for visible destinations.
      var visibleListItems = {};
      for (var i = 0; i < numItems; i++)
        visibleListItems[destinations[i].id] = null;
      // Update visibility for all existing list items.
      this.listItems_.forEach(function(item) {
        var isVisible = visibleListItems.hasOwnProperty(item.destination.id);
        setIsVisible(item.getElement(), isVisible);
        if (isVisible)
          visibleListItems[item.destination.id] = item;
      });
      // Update the existing items, add the new ones (preserve the focused one).
      var listEl = this.getChildElement('.destination-list > ul');
      var focusedEl = listEl.querySelector(':focus');
      for (var i = 0; i < numItems; i++) {
        var listItem = visibleListItems[destinations[i].id];
        if (listItem) {
          // Destination ID is the same, but it can be registered to a different
          // user account, hence passing it to the item update.
          this.updateListItem_(listEl, listItem, focusedEl, destinations[i]);
        } else {
          this.renderListItem_(listEl, destinations[i]);
        }
      }
    },

    /**
     * @param {Element} listEl List element.
     * @param {!print_preview.DestinationListItem} listItem List item to update.
     * @param {Element} focusedEl Currently focused element within the listEl.
     * @param {!print_preview.Destination} destination Destination to render.
     * @private
     */
    updateListItem_: function(listEl, listItem, focusedEl, destination) {
      listItem.update(destination, this.query_);

      var itemEl = listItem.getElement();
      // Preserve focused inner element, if there's one.
      var focusedInnerEl = focusedEl ? itemEl.querySelector(':focus') : null;
      if (focusedEl)
        itemEl.classList.add('moving');
      // Move it to the end of the list.
      listEl.appendChild(itemEl);
      // Restore focus.
      if (focusedEl) {
        if (focusedEl == itemEl || focusedEl == focusedInnerEl)
          focusedEl.focus();
        itemEl.classList.remove('moving');
      }
    },

    /**
     * @param {Element} listEl List element.
     * @param {!print_preview.Destination} destination Destination to render.
     * @private
     */
    renderListItem_: function(listEl, destination) {
      var listItem = new print_preview.DestinationListItem(
          this.eventTarget_, destination, this.query_);
      this.addChild(listItem);
      listItem.render(listEl);
      this.listItems_.push(listItem);
    },

    /**
     * Called when the action link is clicked. Dispatches an
     * ACTION_LINK_ACTIVATED event.
     * @private
     */
    onActionLinkClick_: function() {
      cr.dispatchSimpleEvent(this,
                             DestinationList.EventType.ACTION_LINK_ACTIVATED);
    }
  };

  // Export
  return {
    DestinationList: DestinationList
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Sub-class of a destination list that shows cloud-based destinations.
   * @param {!cr.EventTarget} eventTarget Event target to pass to destination
   *     items for dispatching SELECT events.
   * @constructor
   * @extends {print_preview.DestinationList}
   */
  function CloudDestinationList(eventTarget) {
    print_preview.DestinationList.call(
        this,
        eventTarget,
        loadTimeData.getString('cloudDestinationsTitle'),
        loadTimeData.getString('manage'));
  };

  CloudDestinationList.prototype = {
    __proto__: print_preview.DestinationList.prototype,

    /** @override */
    updateDestinations: function(destinations) {
      // Change the action link from "Manage..." to "Setup..." if user only has
      // Docs and FedEx printers.
      var docsId = print_preview.Destination.GooglePromotedId.DOCS;
      var fedexId = print_preview.Destination.GooglePromotedId.FEDEX;
      if ((destinations.length == 1 && destinations[0].id == docsId) ||
          (destinations.length == 2 &&
           ((destinations[0].id == docsId && destinations[1].id == fedexId) ||
            (destinations[0].id == fedexId && destinations[1].id == docsId)))) {
        this.setActionLinkTextInternal(
            loadTimeData.getString('setupCloudPrinters'));
      } else {
        this.setActionLinkTextInternal(loadTimeData.getString('manage'));
      }
      print_preview.DestinationList.prototype.updateDestinations.call(
          this, destinations);
    }
  };

  return {
    CloudDestinationList: CloudDestinationList
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Sub-class of a destination list that shows recent destinations. This list
   * does not render a "Show all" button.
   * @param {!cr.EventTarget} eventTarget Event target to pass to destination
   *     items for dispatching SELECT events.
   * @constructor
   * @extends {print_preview.DestinationList}
   */
  function RecentDestinationList(eventTarget) {
    print_preview.DestinationList.call(
        this,
        eventTarget,
        loadTimeData.getString('recentDestinationsTitle'),
        null /*actionLinkLabel*/,
        true /*opt_showAll*/);
  };

  RecentDestinationList.prototype = {
    __proto__: print_preview.DestinationList.prototype,

    /** @override */
    updateShortListSize: function(size) {
      this.setShortListSizeInternal(
          Math.max(1, Math.min(size, this.getDestinationsCount())));
    }
  };

  return {
    RecentDestinationList: RecentDestinationList
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Component that renders a destination item in a destination list.
   * @param {!cr.EventTarget} eventTarget Event target to dispatch selection
   *     events to.
   * @param {!print_preview.Destination} destination Destination data object to
   *     render.
   * @param {RegExp} query Active filter query.
   * @constructor
   * @extends {print_preview.Component}
   */
  function DestinationListItem(eventTarget, destination, query) {
    print_preview.Component.call(this);

    /**
     * Event target to dispatch selection events to.
     * @type {!cr.EventTarget}
     * @private
     */
    this.eventTarget_ = eventTarget;

    /**
     * Destination that the list item renders.
     * @type {!print_preview.Destination}
     * @private
     */
    this.destination_ = destination;

    /**
     * Active filter query text.
     * @type {RegExp}
     * @private
     */
    this.query_ = query;

    /**
     * FedEx terms-of-service widget or {@code null} if this list item does not
     * render the FedEx Office print destination.
     * @type {print_preview.FedexTos}
     * @private
     */
    this.fedexTos_ = null;
  };

  /**
   * Event types dispatched by the destination list item.
   * @enum {string}
   */
  DestinationListItem.EventType = {
    // Dispatched when the list item is activated.
    SELECT: 'print_preview.DestinationListItem.SELECT',
    REGISTER_PROMO_CLICKED:
        'print_preview.DestinationListItem.REGISTER_PROMO_CLICKED'
  };

  DestinationListItem.prototype = {
    __proto__: print_preview.Component.prototype,

    /** @override */
    createDom: function() {
      this.setElementInternal(this.cloneTemplateInternal(
          'destination-list-item-template'));
      this.updateUi_();
    },

    /** @override */
    enterDocument: function() {
      print_preview.Component.prototype.enterDocument.call(this);
      this.tracker.add(this.getElement(), 'click', this.onActivate_.bind(this));
      this.tracker.add(
          this.getElement(), 'keydown', this.onKeyDown_.bind(this));
      this.tracker.add(
          this.getChildElement('.register-promo-button'),
          'click',
          this.onRegisterPromoClicked_.bind(this));
    },

    /** @return {!print_preiew.Destination} */
    get destination() {
      return this.destination_;
    },

    /**
     * Updates the list item UI state.
     * @param {!print_preview.Destination} destination Destination data object
     *     to render.
     * @param {RegExp} query Active filter query.
     */
    update: function(destination, query) {
      this.destination_ = destination;
      this.query_ = query;
      this.updateUi_();
    },

    /**
     * Initializes the element with destination's info.
     * @private
     */
    updateUi_: function() {
      var iconImg = this.getChildElement('.destination-list-item-icon');
      iconImg.src = this.destination_.iconUrl;

      var nameEl = this.getChildElement('.destination-list-item-name');
      var textContent = this.destination_.displayName;
      if (this.query_) {
        nameEl.textContent = '';
        // When search query is specified, make it obvious why this particular
        // printer made it to the list. Display name is always visible, even if
        // it does not match the search query.
        this.addTextWithHighlight_(nameEl, textContent);
        // Show the first matching property.
        this.destination_.extraPropertiesToMatch.some(function(property) {
          if (property.match(this.query_)) {
            var hintSpan = document.createElement('span');
            hintSpan.className = 'search-hint';
            nameEl.appendChild(hintSpan);
            this.addTextWithHighlight_(hintSpan, property);
            // Add the same property to the element title.
            textContent += ' (' + property + ')';
            return true;
          }
        }, this);
      } else {
        // Show just the display name and nothing else to lessen visual clutter.
        nameEl.textContent = textContent;
      }
      nameEl.title = textContent;

      if (this.destination_.isExtension) {
        var extensionNameEl = this.getChildElement('.extension-name');
        var extensionName = this.destination_.extensionName;
        extensionNameEl.title = this.destination_.extensionName;
        if (this.query_) {
          extensionNameEl.textContent = '';
          this.addTextWithHighlight_(extensionNameEl, extensionName);
        } else {
          extensionNameEl.textContent = this.destination_.extensionName;
        }

        var extensionIconEl = this.getChildElement('.extension-icon');
        extensionIconEl.style.backgroundImage = '-webkit-image-set(' +
             'url(chrome://extension-icon/' +
                  this.destination_.extensionId + '/24/1) 1x,' +
             'url(chrome://extension-icon/' +
                  this.destination_.extensionId + '/48/1) 2x)';
        extensionIconEl.title = loadTimeData.getStringF(
            'extensionDestinationIconTooltip',
            this.destination_.extensionName);
        extensionIconEl.onclick = this.onExtensionIconClicked_.bind(this);
        extensionIconEl.onkeydown = this.onExtensionIconKeyDown_.bind(this);
      }

      var extensionIndicatorEl =
          this.getChildElement('.extension-controlled-indicator');
      setIsVisible(extensionIndicatorEl, this.destination_.isExtension);

      // Initialize the element which renders the destination's offline status.
      this.getElement().classList.toggle('stale', this.destination_.isOffline);
      var offlineStatusEl = this.getChildElement('.offline-status');
      offlineStatusEl.textContent = this.destination_.offlineStatusText;
      setIsVisible(offlineStatusEl, this.destination_.isOffline);

      // Initialize registration promo element for Privet unregistered printers.
      setIsVisible(
          this.getChildElement('.register-promo'),
          this.destination_.connectionStatus ==
              print_preview.Destination.ConnectionStatus.UNREGISTERED);
    },

    /**
     * Adds text to parent element wrapping search query matches in highlighted
     * spans.
     * @param {!Element} parent Element to build the text in.
     * @param {string} text The text string to highlight segments in.
     * @private
     */
    addTextWithHighlight_: function(parent, text) {
      var sections = text.split(this.query_);
      for (var i = 0; i < sections.length; ++i) {
        if (i % 2 == 0) {
          parent.appendChild(document.createTextNode(sections[i]));
        } else {
          var span = document.createElement('span');
          span.className = 'destination-list-item-query-highlight';
          span.textContent = sections[i];
          parent.appendChild(span);
        }
      }
    },

    /**
     * Called when the destination item is activated. Dispatches a SELECT event
     * on the given event target.
     * @private
     */
    onActivate_: function() {
      if (this.destination_.id ==
              print_preview.Destination.GooglePromotedId.FEDEX &&
          !this.destination_.isTosAccepted) {
        if (!this.fedexTos_) {
          this.fedexTos_ = new print_preview.FedexTos();
          this.fedexTos_.render(this.getElement());
          this.tracker.add(
              this.fedexTos_,
              print_preview.FedexTos.EventType.AGREE,
              this.onTosAgree_.bind(this));
        }
        this.fedexTos_.setIsVisible(true);
      } else if (this.destination_.connectionStatus !=
                     print_preview.Destination.ConnectionStatus.UNREGISTERED) {
        var selectEvt = new Event(DestinationListItem.EventType.SELECT);
        selectEvt.destination = this.destination_;
        this.eventTarget_.dispatchEvent(selectEvt);
      }
    },

    /**
     * Called when the key is pressed on the destination item. Dispatches a
     * SELECT event when Enter is pressed.
     * @param {KeyboardEvent} e Keyboard event to process.
     * @private
     */
    onKeyDown_: function(e) {
      if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.keyCode == 13) {
          var activeElementTag = document.activeElement ?
              document.activeElement.tagName.toUpperCase() : '';
          if (activeElementTag == 'LI') {
            e.stopPropagation();
            e.preventDefault();
            this.onActivate_();
          }
        }
      }
    },

    /**
     * Called when the user agrees to the print destination's terms-of-service.
     * Selects the print destination that was agreed to.
     * @private
     */
    onTosAgree_: function() {
      var selectEvt = new Event(DestinationListItem.EventType.SELECT);
      selectEvt.destination = this.destination_;
      this.eventTarget_.dispatchEvent(selectEvt);
    },

    /**
     * Called when the registration promo is clicked.
     * @private
     */
    onRegisterPromoClicked_: function() {
      var promoClickedEvent = new Event(
          DestinationListItem.EventType.REGISTER_PROMO_CLICKED);
      promoClickedEvent.destination = this.destination_;
      this.eventTarget_.dispatchEvent(promoClickedEvent);
    },

    /**
     * Handles click and 'Enter' key down events for the extension icon element.
     * It opens extensions page with the extension associated with the
     * destination highlighted.
     * @param {MouseEvent|KeyboardEvent} e The event to handle.
     * @private
     */
    onExtensionIconClicked_: function(e) {
      e.stopPropagation();
      window.open('chrome://extensions?id=' + this.destination_.extensionId);
    },

    /**
     * Handles key down event for the extensin icon element. Keys different than
     * 'Enter' are ignored.
     * @param {KeyboardEvent} e The event to handle.
     * @private
     */
    onExtensionIconKeyDown_: function(e) {
      if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey)
        return;
      if (e.keyCode != 13 /* Enter */)
        return;
      this.onExtensionIconClicked_(event);
    }
  };

  // Export
  return {
    DestinationListItem: DestinationListItem
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Component used for searching for a print destination.
   * This is a modal dialog that allows the user to search and select a
   * destination to print to. When a destination is selected, it is written to
   * the destination store.
   * @param {!print_preview.DestinationStore} destinationStore Data store
   *     containing the destinations to search through.
   * @param {!print_preview.InvitationStore} invitationStore Data store
   *     holding printer sharing invitations.
   * @param {!print_preview.UserInfo} userInfo Event target that contains
   *     information about the logged in user.
   * @constructor
   * @extends {print_preview.Overlay}
   */
  function DestinationSearch(destinationStore, invitationStore, userInfo) {
    print_preview.Overlay.call(this);

    /**
     * Data store containing the destinations to search through.
     * @type {!print_preview.DestinationStore}
     * @private
     */
    this.destinationStore_ = destinationStore;

    /**
     * Data store holding printer sharing invitations.
     * @type {!print_preview.DestinationStore}
     * @private
     */
    this.invitationStore_ = invitationStore;

    /**
     * Event target that contains information about the logged in user.
     * @type {!print_preview.UserInfo}
     * @private
     */
    this.userInfo_ = userInfo;

    /**
     * Currently displayed printer sharing invitation.
     * @type {print_preview.Invitation}
     * @private
     */
    this.invitation_ = null;

    /**
     * Used to record usage statistics.
     * @type {!print_preview.DestinationSearchMetricsContext}
     * @private
     */
    this.metrics_ = new print_preview.DestinationSearchMetricsContext();

    /**
     * Whether or not a UMA histogram for the register promo being shown was
     * already recorded.
     * @type {boolean}
     * @private
     */
    this.registerPromoShownMetricRecorded_ = false;

    /**
     * Child overlay used for resolving a provisional destination. The overlay
     * is shown when the user attempts to select a provisional destination.
     * Set only when a destination is being resolved.
     * @private {?print_preview.ProvisionalDestinationResolver}
     */
    this.provisionalDestinationResolver_ = null;

    /**
     * Search box used to search through the destination lists.
     * @type {!print_preview.SearchBox}
     * @private
     */
    this.searchBox_ = new print_preview.SearchBox(
        loadTimeData.getString('searchBoxPlaceholder'));
    this.addChild(this.searchBox_);

    /**
     * Destination list containing recent destinations.
     * @type {!print_preview.DestinationList}
     * @private
     */
    this.recentList_ = new print_preview.RecentDestinationList(this);
    this.addChild(this.recentList_);

    /**
     * Destination list containing local destinations.
     * @type {!print_preview.DestinationList}
     * @private
     */
    this.localList_ = new print_preview.DestinationList(
        this,
        loadTimeData.getString('localDestinationsTitle'),
        loadTimeData.getBoolean('showLocalManageButton') ?
            loadTimeData.getString('manage') : null);
    this.addChild(this.localList_);

    /**
     * Destination list containing cloud destinations.
     * @type {!print_preview.DestinationList}
     * @private
     */
    this.cloudList_ = new print_preview.CloudDestinationList(this);
    this.addChild(this.cloudList_);
  };

  /**
   * Event types dispatched by the component.
   * @enum {string}
   */
  DestinationSearch.EventType = {
    // Dispatched when user requests to sign-in into another Google account.
    ADD_ACCOUNT: 'print_preview.DestinationSearch.ADD_ACCOUNT',

    // Dispatched when the user requests to manage their cloud destinations.
    MANAGE_CLOUD_DESTINATIONS:
        'print_preview.DestinationSearch.MANAGE_CLOUD_DESTINATIONS',

    // Dispatched when the user requests to manage their local destinations.
    MANAGE_LOCAL_DESTINATIONS:
        'print_preview.DestinationSearch.MANAGE_LOCAL_DESTINATIONS',

    // Dispatched when the user requests to sign-in to their Google account.
    SIGN_IN: 'print_preview.DestinationSearch.SIGN_IN'
  };

  /**
   * Number of unregistered destinations that may be promoted to the top.
   * @type {number}
   * @const
   * @private
   */
  DestinationSearch.MAX_PROMOTED_UNREGISTERED_PRINTERS_ = 2;

  DestinationSearch.prototype = {
    __proto__: print_preview.Overlay.prototype,

    /** @override */
    onSetVisibleInternal: function(isVisible) {
      if (isVisible) {
        this.searchBox_.focus();
        if (getIsVisible(this.getChildElement('.cloudprint-promo'))) {
          this.metrics_.record(
              print_preview.Metrics.DestinationSearchBucket.SIGNIN_PROMPT);
          chrome.send(
              'metricsHandler:recordAction',
              ['Signin_Impression_FromCloudPrint']);
        }
        if (this.userInfo_.initialized)
          this.onUsersChanged_();
        this.reflowLists_();
        this.metrics_.record(
            print_preview.Metrics.DestinationSearchBucket.DESTINATION_SHOWN);

        this.destinationStore_.startLoadAllDestinations();
        this.invitationStore_.startLoadingInvitations();
      } else {
        // Collapse all destination lists
        this.localList_.setIsShowAll(false);
        this.cloudList_.setIsShowAll(false);
        if (this.provisionalDestinationResolver_)
          this.provisionalDestinationResolver_.cancel();
        this.resetSearch_();
      }
    },

    /** @override */
    onCancelInternal: function() {
      this.metrics_.record(print_preview.Metrics.DestinationSearchBucket.
          DESTINATION_CLOSED_UNCHANGED);
    },

    /** Shows the Google Cloud Print promotion banner. */
    showCloudPrintPromo: function() {
      setIsVisible(this.getChildElement('.cloudprint-promo'), true);
      if (this.getIsVisible()) {
        this.metrics_.record(
            print_preview.Metrics.DestinationSearchBucket.SIGNIN_PROMPT);
        chrome.send(
            'metricsHandler:recordAction',
            ['Signin_Impression_FromCloudPrint']);
      }
      this.reflowLists_();
    },

    /** @override */
    enterDocument: function() {
      print_preview.Overlay.prototype.enterDocument.call(this);

      this.tracker.add(
          this.getChildElement('.account-select'),
          'change',
          this.onAccountChange_.bind(this));

      this.tracker.add(
          this.getChildElement('.sign-in'),
          'click',
          this.onSignInActivated_.bind(this));

      this.tracker.add(
          this.getChildElement('.invitation-accept-button'),
          'click',
          this.onInvitationProcessButtonClick_.bind(this, true /*accept*/));
      this.tracker.add(
          this.getChildElement('.invitation-reject-button'),
          'click',
          this.onInvitationProcessButtonClick_.bind(this, false /*accept*/));

      this.tracker.add(
          this.getChildElement('.cloudprint-promo > .close-button'),
          'click',
          this.onCloudprintPromoCloseButtonClick_.bind(this));
      this.tracker.add(
          this.searchBox_,
          print_preview.SearchBox.EventType.SEARCH,
          this.onSearch_.bind(this));
      this.tracker.add(
          this,
          print_preview.DestinationListItem.EventType.SELECT,
          this.onDestinationSelect_.bind(this));
      this.tracker.add(
          this,
          print_preview.DestinationListItem.EventType.REGISTER_PROMO_CLICKED,
          function() {
            this.metrics_.record(print_preview.Metrics.DestinationSearchBucket.
                REGISTER_PROMO_SELECTED);
          }.bind(this));

      this.tracker.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.DESTINATIONS_INSERTED,
          this.onDestinationsInserted_.bind(this));
      this.tracker.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.DESTINATION_SELECT,
          this.onDestinationStoreSelect_.bind(this));
      this.tracker.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.DESTINATION_SEARCH_STARTED,
          this.updateThrobbers_.bind(this));
      this.tracker.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType.DESTINATION_SEARCH_DONE,
          this.onDestinationSearchDone_.bind(this));
      this.tracker.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType
              .PROVISIONAL_DESTINATION_RESOLVED,
          this.onDestinationsInserted_.bind(this));

      this.tracker.add(
          this.invitationStore_,
          print_preview.InvitationStore.EventType.INVITATION_SEARCH_DONE,
          this.updateInvitations_.bind(this));
      this.tracker.add(
          this.invitationStore_,
          print_preview.InvitationStore.EventType.INVITATION_PROCESSED,
          this.updateInvitations_.bind(this));

      this.tracker.add(
          this.localList_,
          print_preview.DestinationList.EventType.ACTION_LINK_ACTIVATED,
          this.onManageLocalDestinationsActivated_.bind(this));
      this.tracker.add(
          this.cloudList_,
          print_preview.DestinationList.EventType.ACTION_LINK_ACTIVATED,
          this.onManageCloudDestinationsActivated_.bind(this));

      this.tracker.add(
          this.userInfo_,
          print_preview.UserInfo.EventType.USERS_CHANGED,
          this.onUsersChanged_.bind(this));

      this.tracker.add(
          this.getChildElement('.button-strip .cancel-button'),
          'click',
          this.cancel.bind(this));

      this.tracker.add(window, 'resize', this.onWindowResize_.bind(this));

      this.updateThrobbers_();

      // Render any destinations already in the store.
      this.renderDestinations_();
    },

    /** @override */
    decorateInternal: function() {
      this.searchBox_.render(this.getChildElement('.search-box-container'));
      this.recentList_.render(this.getChildElement('.recent-list'));
      this.localList_.render(this.getChildElement('.local-list'));
      this.cloudList_.render(this.getChildElement('.cloud-list'));
      this.getChildElement('.promo-text').innerHTML = loadTimeData.getStringF(
          'cloudPrintPromotion',
          '<a is="action-link" class="sign-in">',
          '</a>');
      this.getChildElement('.account-select-label').textContent =
          loadTimeData.getString('accountSelectTitle');
    },

    /**
     * @return {number} Height available for destination lists, in pixels.
     * @private
     */
    getAvailableListsHeight_: function() {
      var elStyle = window.getComputedStyle(this.getElement());
      return this.getElement().offsetHeight -
          parseInt(elStyle.getPropertyValue('padding-top'), 10) -
          parseInt(elStyle.getPropertyValue('padding-bottom'), 10) -
          this.getChildElement('.lists').offsetTop -
          this.getChildElement('.invitation-container').offsetHeight -
          this.getChildElement('.cloudprint-promo').offsetHeight -
          this.getChildElement('.action-area').offsetHeight;
    },

    /**
     * Filters all destination lists with the given query.
     * @param {RegExp} query Query to filter destination lists by.
     * @private
     */
    filterLists_: function(query) {
      this.recentList_.updateSearchQuery(query);
      this.localList_.updateSearchQuery(query);
      this.cloudList_.updateSearchQuery(query);
    },

    /**
     * Resets the search query.
     * @private
     */
    resetSearch_: function() {
      this.searchBox_.setQuery(null);
      this.filterLists_(null);
    },

    /**
     * Renders all of the destinations in the destination store.
     * @private
     */
    renderDestinations_: function() {
      var recentDestinations = [];
      var localDestinations = [];
      var cloudDestinations = [];
      var unregisteredCloudDestinations = [];

      var destinations =
          this.destinationStore_.destinations(this.userInfo_.activeUser);
      destinations.forEach(function(destination) {
        if (destination.isRecent) {
          recentDestinations.push(destination);
        }
        if (destination.isLocal ||
            destination.origin == print_preview.Destination.Origin.DEVICE) {
          localDestinations.push(destination);
        } else {
          if (destination.connectionStatus ==
                print_preview.Destination.ConnectionStatus.UNREGISTERED) {
            unregisteredCloudDestinations.push(destination);
          } else {
            cloudDestinations.push(destination);
          }
        }
      });

      if (unregisteredCloudDestinations.length != 0 &&
          !this.registerPromoShownMetricRecorded_) {
        this.metrics_.record(
            print_preview.Metrics.DestinationSearchBucket.REGISTER_PROMO_SHOWN);
        this.registerPromoShownMetricRecorded_ = true;
      }

      var finalCloudDestinations = unregisteredCloudDestinations.slice(
        0, DestinationSearch.MAX_PROMOTED_UNREGISTERED_PRINTERS_).concat(
          cloudDestinations,
          unregisteredCloudDestinations.slice(
            DestinationSearch.MAX_PROMOTED_UNREGISTERED_PRINTERS_));

      this.recentList_.updateDestinations(recentDestinations);
      this.localList_.updateDestinations(localDestinations);
      this.cloudList_.updateDestinations(finalCloudDestinations);
    },

    /**
     * Reflows the destination lists according to the available height.
     * @private
     */
    reflowLists_: function() {
      if (!this.getIsVisible()) {
        return;
      }

      var hasCloudList = getIsVisible(this.getChildElement('.cloud-list'));
      var lists = [this.recentList_, this.localList_];
      if (hasCloudList) {
        lists.push(this.cloudList_);
      }

      var getListsTotalHeight = function(lists, counts) {
        return lists.reduce(function(sum, list, index) {
          var container = list.getContainerElement();
          return sum + list.getEstimatedHeightInPixels(counts[index]) +
              parseInt(window.getComputedStyle(container).paddingBottom, 10);
        }, 0);
      };
      var getCounts = function(lists, count) {
        return lists.map(function(list) { return count; });
      };

      var availableHeight = this.getAvailableListsHeight_();
      var listsEl = this.getChildElement('.lists');
      listsEl.style.maxHeight = availableHeight + 'px';

      var maxListLength = lists.reduce(function(prevCount, list) {
        return Math.max(prevCount, list.getDestinationsCount());
      }, 0);
      for (var i = 1; i <= maxListLength; i++) {
        if (getListsTotalHeight(lists, getCounts(lists, i)) > availableHeight) {
          i--;
          break;
        }
      }
      var counts = getCounts(lists, i);
      // Fill up the possible n-1 free slots left by the previous loop.
      if (getListsTotalHeight(lists, counts) < availableHeight) {
        for (var countIndex = 0; countIndex < counts.length; countIndex++) {
          counts[countIndex]++;
          if (getListsTotalHeight(lists, counts) > availableHeight) {
            counts[countIndex]--;
            break;
          }
        }
      }

      lists.forEach(function(list, index) {
        list.updateShortListSize(counts[index]);
      });

      // Set height of the list manually so that search filter doesn't change
      // lists height.
      var listsHeight = getListsTotalHeight(lists, counts) + 'px';
      if (listsHeight != listsEl.style.height) {
        // Try to close account select if there's a possibility it's open now.
        var accountSelectEl = this.getChildElement('.account-select');
        if (!accountSelectEl.disabled) {
          accountSelectEl.disabled = true;
          accountSelectEl.disabled = false;
        }
        listsEl.style.height = listsHeight;
      }
    },

    /**
     * Updates whether the throbbers for the various destination lists should be
     * shown or hidden.
     * @private
     */
    updateThrobbers_: function() {
      this.localList_.setIsThrobberVisible(
          this.destinationStore_.isLocalDestinationSearchInProgress);
      this.cloudList_.setIsThrobberVisible(
          this.destinationStore_.isCloudDestinationSearchInProgress);
      this.recentList_.setIsThrobberVisible(
          this.destinationStore_.isLocalDestinationSearchInProgress &&
          this.destinationStore_.isCloudDestinationSearchInProgress);
      this.reflowLists_();
    },

    /**
     * Updates printer sharing invitations UI.
     * @private
     */
    updateInvitations_: function() {
      var invitations = this.userInfo_.activeUser ?
          this.invitationStore_.invitations(this.userInfo_.activeUser) : [];
      if (invitations.length > 0) {
        if (this.invitation_ != invitations[0]) {
          this.metrics_.record(print_preview.Metrics.DestinationSearchBucket.
              INVITATION_AVAILABLE);
        }
        this.invitation_ = invitations[0];
        this.showInvitation_(this.invitation_);
      } else {
        this.invitation_ = null;
      }
      setIsVisible(
          this.getChildElement('.invitation-container'), !!this.invitation_);
      this.reflowLists_();
    },

    /**
     * @param {!printe_preview.Invitation} invitation Invitation to show.
     * @private
     */
    showInvitation_: function(invitation) {
      var invitationText = '';
      if (invitation.asGroupManager) {
        invitationText = loadTimeData.getStringF(
            'groupPrinterSharingInviteText',
            HTMLEscape(invitation.sender),
            HTMLEscape(invitation.destination.displayName),
            HTMLEscape(invitation.receiver));
      } else {
        invitationText = loadTimeData.getStringF(
            'printerSharingInviteText',
            HTMLEscape(invitation.sender),
            HTMLEscape(invitation.destination.displayName));
      }
      this.getChildElement('.invitation-text').innerHTML = invitationText;

      var acceptButton = this.getChildElement('.invitation-accept-button');
      acceptButton.textContent = loadTimeData.getString(
          invitation.asGroupManager ? 'acceptForGroup' : 'accept');
      acceptButton.disabled = !!this.invitationStore_.invitationInProgress;
      this.getChildElement('.invitation-reject-button').disabled =
          !!this.invitationStore_.invitationInProgress;
      setIsVisible(
          this.getChildElement('#invitation-process-throbber'),
          !!this.invitationStore_.invitationInProgress);
    },

    /**
     * Called when user's logged in accounts change. Updates the UI.
     * @private
     */
    onUsersChanged_: function() {
      var loggedIn = this.userInfo_.loggedIn;
      if (loggedIn) {
        var accountSelectEl = this.getChildElement('.account-select');
        accountSelectEl.innerHTML = '';
        this.userInfo_.users.forEach(function(account) {
          var option = document.createElement('option');
          option.text = account;
          option.value = account;
          accountSelectEl.add(option);
        });
        var option = document.createElement('option');
        option.text = loadTimeData.getString('addAccountTitle');
        option.value = '';
        accountSelectEl.add(option);

        accountSelectEl.selectedIndex =
            this.userInfo_.users.indexOf(this.userInfo_.activeUser);
      }

      setIsVisible(this.getChildElement('.user-info'), loggedIn);
      setIsVisible(this.getChildElement('.cloud-list'), loggedIn);
      setIsVisible(this.getChildElement('.cloudprint-promo'), !loggedIn);
      this.updateInvitations_();
    },

    /**
     * Called when a destination search should be executed. Filters the
     * destination lists with the given query.
     * @param {Event} evt Contains the search query.
     * @private
     */
    onSearch_: function(evt) {
      this.filterLists_(evt.queryRegExp);
    },

    /**
     * Handler for {@code print_preview.DestinationListItem.EventType.SELECT}
     * event, which is called when a destinationi list item is selected.
     * @param {Event} evt Contains the selected destination.
     * @private
     */
    onDestinationSelect_: function(evt) {
      this.handleOnDestinationSelect_(evt.destination);
    },

    /**
     * Called when a destination is selected. Clears the search and hides the
     * widget. If The destination is provisional, it runs provisional
     * destination resolver first.
     * @param {!print_preview.Destination} destination The selected destination.
     * @private
     */
    handleOnDestinationSelect_: function(destination) {
      if (destination.isProvisional) {
        assert(!this.provisionalDestinationResolver_,
               'Provisional destination resolver already exists.');
        this.provisionalDestinationResolver_ =
            print_preview.ProvisionalDestinationResolver.create(
                this.destinationStore_, destination);
        assert(!!this.provisionalDestinationResolver_,
               'Unable to create provisional destination resolver');

        var lastFocusedElement = document.activeElement;
        this.addChild(this.provisionalDestinationResolver_);
        this.provisionalDestinationResolver_.run(this.getElement())
            .then(
                /**
                 * @param {!print_preview.Destination} resolvedDestination
                 *    Destination to which the provisional destination was
                 *    resolved.
                 */
                function(resolvedDestination) {
                  this.handleOnDestinationSelect_(resolvedDestination);
                }.bind(this))
            .catch(
                function() {
                  console.log('Failed to resolve provisional destination: ' +
                              destination.id);
                })
            .then(
                function() {
                  this.removeChild(this.provisionalDestinationResolver_);
                  this.provisionalDestinationResolver_ = null;

                  // Restore focus to the previosly focused element if it's
                  // still shown in the search.
                  if (lastFocusedElement &&
                      this.getIsVisible() &&
                      getIsVisible(lastFocusedElement) &&
                      this.getElement().contains(lastFocusedElement)) {
                    lastFocusedElement.focus();
                  }
                }.bind(this));
        return;
      }

      this.setIsVisible(false);
      this.destinationStore_.selectDestination(destination);
      this.metrics_.record(print_preview.Metrics.DestinationSearchBucket.
          DESTINATION_CLOSED_CHANGED);
    },

    /**
     * Called when a destination is selected. Selected destination are marked as
     * recent, so we have to update our recent destinations list.
     * @private
     */
    onDestinationStoreSelect_: function() {
      var destinations =
          this.destinationStore_.destinations(this.userInfo_.activeUser);
      var recentDestinations = [];
      destinations.forEach(function(destination) {
        if (destination.isRecent) {
          recentDestinations.push(destination);
        }
      });
      this.recentList_.updateDestinations(recentDestinations);
      this.reflowLists_();
    },

    /**
     * Called when destinations are inserted into the store. Rerenders
     * destinations.
     * @private
     */
    onDestinationsInserted_: function() {
      this.renderDestinations_();
      this.reflowLists_();
    },

    /**
     * Called when destinations are inserted into the store. Rerenders
     * destinations.
     * @private
     */
    onDestinationSearchDone_: function() {
      this.updateThrobbers_();
      this.renderDestinations_();
      this.reflowLists_();
      // In case user account information was retrieved with this search
      // (knowing current user account is required to fetch invitations).
      this.invitationStore_.startLoadingInvitations();
    },

    /**
     * Called when the manage cloud printers action is activated.
     * @private
     */
    onManageCloudDestinationsActivated_: function() {
      cr.dispatchSimpleEvent(
          this,
          print_preview.DestinationSearch.EventType.MANAGE_CLOUD_DESTINATIONS);
    },

    /**
     * Called when the manage local printers action is activated.
     * @private
     */
    onManageLocalDestinationsActivated_: function() {
      cr.dispatchSimpleEvent(
          this,
          print_preview.DestinationSearch.EventType.MANAGE_LOCAL_DESTINATIONS);
    },

    /**
     * Called when the "Sign in" link on the Google Cloud Print promo is
     * activated.
     * @private
     */
    onSignInActivated_: function() {
      cr.dispatchSimpleEvent(this, DestinationSearch.EventType.SIGN_IN);
      this.metrics_.record(
          print_preview.Metrics.DestinationSearchBucket.SIGNIN_TRIGGERED);
    },

    /**
     * Called when item in the Accounts list is selected. Initiates active user
     * switch or, for 'Add account...' item, opens Google sign-in page.
     * @private
     */
    onAccountChange_: function() {
      var accountSelectEl = this.getChildElement('.account-select');
      var account =
          accountSelectEl.options[accountSelectEl.selectedIndex].value;
      if (account) {
        this.userInfo_.activeUser = account;
        this.destinationStore_.reloadUserCookieBasedDestinations();
        this.invitationStore_.startLoadingInvitations();
        this.metrics_.record(
            print_preview.Metrics.DestinationSearchBucket.ACCOUNT_CHANGED);
      } else {
        cr.dispatchSimpleEvent(this, DestinationSearch.EventType.ADD_ACCOUNT);
        // Set selection back to the active user.
        for (var i = 0; i < accountSelectEl.options.length; i++) {
          if (accountSelectEl.options[i].value == this.userInfo_.activeUser) {
            accountSelectEl.selectedIndex = i;
            break;
          }
        }
        this.metrics_.record(
            print_preview.Metrics.DestinationSearchBucket.ADD_ACCOUNT_SELECTED);
      }
    },

    /**
     * Called when the printer sharing invitation Accept/Reject button is
     * clicked.
     * @private
     */
    onInvitationProcessButtonClick_: function(accept) {
      this.metrics_.record(accept ?
          print_preview.Metrics.DestinationSearchBucket.INVITATION_ACCEPTED :
          print_preview.Metrics.DestinationSearchBucket.INVITATION_REJECTED);
      this.invitationStore_.processInvitation(this.invitation_, accept);
      this.updateInvitations_();
    },

    /**
     * Called when the close button on the cloud print promo is clicked. Hides
     * the promo.
     * @private
     */
    onCloudprintPromoCloseButtonClick_: function() {
      setIsVisible(this.getChildElement('.cloudprint-promo'), false);
      this.reflowLists_();
    },

    /**
     * Called when the window is resized. Reflows layout of destination lists.
     * @private
     */
    onWindowResize_: function() {
      this.reflowLists_();
    }
  };

  // Export
  return {
    DestinationSearch: DestinationSearch
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /**
   * Widget that renders a terms-of-service agreement for using the FedEx Office
   * print destination.
   * @constructor
   * @extends {print_preview.Component}
   */
  function FedexTos() {
    print_preview.Component.call(this);
  };

  /**
   * Enumeration of event types dispatched by the widget.
   * @enum {string}
   */
  FedexTos.EventType = {
    // Dispatched when the user agrees to the terms-of-service.
    AGREE: 'print_preview.FedexTos.AGREE'
  };

  FedexTos.prototype = {
    __proto__: print_preview.Component.prototype,

    /** @param {boolean} isVisible Whether the widget is visible. */
    setIsVisible: function(isVisible) {
      if (isVisible) {
        var heightHelperEl = this.getElement().querySelector('.height-helper');
        this.getElement().style.height = heightHelperEl.offsetHeight + 'px';
      } else {
        this.getElement().style.height = 0;
      }
    },

    /** @override */
    createDom: function() {
      this.setElementInternal(this.cloneTemplateInternal('fedex-tos-template'));
      var tosTextEl = this.getElement().querySelector('.tos-text');
      tosTextEl.innerHTML = loadTimeData.getStringF(
          'fedexTos',
          '<a href="http://www.fedex.com/us/office/copyprint/online/' +
              'googlecloudprint/termsandconditions">',
          '</a>');
    },

    /** @override */
    enterDocument: function() {
      var agreeCheckbox = this.getElement().querySelector('.agree-checkbox');
      this.tracker.add(
          agreeCheckbox, 'click', this.onAgreeCheckboxClick_.bind(this));
    },

    /**
     * Called when the agree checkbox is clicked. Dispatches a AGREE event.
     * @private
     */
    onAgreeCheckboxClick_: function() {
      cr.dispatchSimpleEvent(this, FedexTos.EventType.AGREE);
    }
  };

  // Export
  return {
    FedexTos: FedexTos
  };
});

// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('print_preview', function() {
  'use strict';

  /** @enum {string} */
  var ResolverState = {
    INITIAL: 'INITIAL',
    ACTIVE: 'ACTIVE',
    GRANTING_PERMISSION: 'GRANTING_PERMISSION',
    ERROR: 'ERROR',
    DONE: 'DONE'
  };

  /**
   * Overlay used to resolve a provisional extension destination. The user is
   * prompted to allow print preview to grant a USB device access to an
   * extension associated with the destination. If user agrees destination
   * resolvement is attempted (which includes granting the extension USB access
   * and requesting destination description from the extension). The overlay is
   * hidden when destination resolving is done.
   *
   * @param {!print_preview.DestinationStore} destinationStore The destination
   *    store containing the destination. Used as a proxy to native layer for
   *    resolving the destination.
   * @param {!print_preview.Destination} destination The destination that has
   *     to be resolved.
   * @constructor
   * @extends {print_preview.Overlay}
   */
  function ProvisionalDestinationResolver(destinationStore, destination) {
    print_preview.Overlay.call(this);

    /** @private {!print_preview.DestinationStore} */
    this.destinationStore_ = destinationStore;
    /** @private {!print_preview.Destination} */
    this.destination_ = destination;

    /** @private {ResolverState} */
    this.state_ = ResolverState.INITIAL;

    /**
     * Promise resolver for promise returned by {@code this.run}.
     * @private {?PromiseResolver<!print_preview.Destination>}
     */
    this.promiseResolver_ = null;
  }

  /**
   * @param {!print_preview.DestinationStore} store
   * @param {!print_preview.Destination} destination
   * @return {?ProvisionalDestinationResolver}
   */
  ProvisionalDestinationResolver.create = function(store, destination) {
    if (destination.provisionalType !=
            print_preview.Destination.ProvisionalType.NEEDS_USB_PERMISSION) {
      return null;
    }
    return new ProvisionalDestinationResolver(store, destination);
  };

  ProvisionalDestinationResolver.prototype = {
    __proto__: print_preview.Overlay.prototype,

    /** @override */
    enterDocument: function() {
      print_preview.Overlay.prototype.enterDocument.call(this);

      this.tracker.add(
          this.getChildElement('.usb-permission-ok-button'),
          'click',
          this.startResolveDestination_.bind(this));
      this.tracker.add(
          this.getChildElement('.cancel'),
          'click',
          this.cancel.bind(this));

      this.tracker.add(
          this.destinationStore_,
          print_preview.DestinationStore.EventType
              .PROVISIONAL_DESTINATION_RESOLVED,
          this.onDestinationResolved_.bind(this));
    },

    /** @override */
    onSetVisibleInternal: function(visible) {
      if (visible) {
        assert(this.state_ == ResolverState.INITIAL,
               'Showing overlay while not in initial state.');
        assert(!this.promiseResolver_, 'Promise resolver already set.');
        this.setState_(ResolverState.ACTIVE);
        this.promiseResolver_ = new PromiseResolver();
        this.getChildElement('.default').focus();
      } else if (this.state_ != ResolverState.DONE) {
        assert(this.state_ != ResolverState.INITIAL, 'Hiding in initial state');
        this.setState_(ResolverState.DONE);
        this.promiseResolver_.reject();
        this.promiseResolver_ = null;
      }
    },

    /** @override */
    createDom: function() {
      this.setElementInternal(this.cloneTemplateInternal(
          'extension-usb-resolver'));

      var extNameEl = this.getChildElement('.usb-permission-extension-name');
      extNameEl.title = this.destination_.extensionName;
      extNameEl.textContent = this.destination_.extensionName;

      var extIconEl = this.getChildElement('.usb-permission-extension-icon');
      extIconEl.style.backgroundImage = '-webkit-image-set(' +
          'url(chrome://extension-icon/' +
               this.destination_.extensionId + '/24/1) 1x,' +
          'url(chrome://extension-icon/' +
               this.destination_.extensionId + '/48/1) 2x)';
    },

    /**
     * Handler for click on OK button. It initiates destination resolving.
     * @private
     */
    startResolveDestination_: function() {
      assert(this.state_ == ResolverState.ACTIVE,
             'Invalid state in request grant permission');

      this.setState_(ResolverState.GRANTING_PERMISSION);
      this.destinationStore_.resolveProvisionalDestination(this.destination_);
    },

    /**
     * Handler for PROVISIONAL_DESTINATION_RESOLVED event. It finalizes the
     * resolver state once the destination associated with the resolver gets
     * resolved.
     * @param {Event} event
     * @private
     */
    onDestinationResolved_: function(event) {
      if (this.state_ == ResolverState.DONE)
        return;

      if (event.provisionalId != this.destination_.id)
        return;

      if (event.destination) {
        this.setState_(ResolverState.DONE);
        this.promiseResolver_.resolve(event.destination);
        this.promiseResolver_ = null;
        this.setIsVisible(false);
      } else {
        this.setState_(ResolverState.ERROR);
      }
    },

    /**
     * Sets new resolver state and updates the UI accordingly.
     * @param {ResolverState} state
     * @private
     */
    setState_: function(state) {
      if (this.state_ == state)
        return;

      this.state_ = state;
      this.updateUI_();
    },

    /**
     * Updates the resolver overlay UI to match the resolver state.
     * @private
     */
    updateUI_: function() {
      this.getChildElement('.usb-permission-ok-button').hidden =
          this.state_ == ResolverState.ERROR;
      this.getChildElement('.usb-permission-ok-button').disabled =
          this.state_ != ResolverState.ACTIVE;

      // If OK button is disabled, make sure Cancel button gets focus.
      if (this.state_ != ResolverState.ACTIVE)
        this.getChildElement('.cancel').focus();

      this.getChildElement('.throbber-placeholder').classList.toggle(
          'throbber',
          this.state_ == ResolverState.GRANTING_PERMISSION);

      this.getChildElement('.usb-permission-extension-desc').hidden =
          this.state_ == ResolverState.ERROR;

      this.getChildElement('.usb-permission-message').textContent =
          this.state_ == ResolverState.ERROR ?
              loadTimeData.getStringF('resolveExtensionUSBErrorMessage',
                                      this.destination_.extensionName) :
              loadTimeData.getString('resolveExtensionUSBPermissionMessage');
    },

    /**
     * Initiates and shows the resolver overlay.
     * @param {!HTMLElement} parent The element that should parent the resolver
     *     UI.
     * @return {!Promise<!print_preview.Destination>} Promise that will be
     * fulfilled when the destination resolving is finished.
     */
    run: function(parent) {
      this.render(parent);
      this.setIsVisible(true);

      assert(this.promiseResolver_, 'Promise resolver not created.');
      return this.promiseResolver_.promise;
    }
  };

  return {
    ProvisionalDestinationResolver: ProvisionalDestinationResolver
  };
});


window.addEventListener('DOMContentLoaded', function() {
  printPreview = new print_preview.PrintPreview();
  printPreview.initialize();
});
