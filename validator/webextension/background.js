/**
 * @license
 * Copyright 2016 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the license.
 */
window.browser = window.browser || window.chrome;

var globals = {};
globals.ampCacheBgcolor = "#ffffff";
globals.ampCacheIconPrefix = "amp-link";
globals.ampCacheTitle = browser.i18n.getMessage("pageFromAmpCacheTitle");
globals.ampPopup = "amp-validator.build.html";
globals.invalidAmpBgcolor = "#8b0000";
globals.invalidAmpIconPrefix = "invalid";
globals.invalidAmpTitle = browser.i18n.getMessage("pageFailsValidationTitle");
globals.linkToAmpBgColor = "#ffffff";
globals.linkToAmpIconPrefix = "amp-link";
globals.linkToAmpTitle = browser.i18n.getMessage("pageHasAmpAltTitle");
globals.tabToUrl = {};
globals.validAmpBgcolor = "#ffd700";
globals.validAmpIconPrefix = "valid";
globals.validAmpTitle = browser.i18n.getMessage("pagePassesValidationTitle");

/**
 * Format a hex value (HTML colors such as #ffffff) as an RGBA.
 *
 * @param {string} hex
 * @return {string} rgba
 */
function hex2rgba(hex) {
  // Remove the '#' char if necessary.
  if (hex.charAt(0) === "#") { hex = hex.slice(1); }
  hex = hex.toUpperCase();
  var hexAlpha = "0123456789ABCDEF", value = new Array(4), k = 0, int1, int2, i;
  for (i = 0; i < 6; i += 2) {
    int1 = hexAlpha.indexOf(hex.charAt(i));
    int2 = hexAlpha.indexOf(hex.charAt(i + 1));
    value[k] = (int1 * 16) + int2;
    k += 1;
  }
  value[3] = 255;
  return value;
}

/**
 * Returns a dictionary of the number of errors and warnings that occur
 * in the set of ValidationErrors.
 *
 * @param {Array<ValidationError>} errors Validation errors and/or warnings.
 * @return {Object}
 */
function getErrorSeverityCounts(errors) {
  var numErrors = 0;
  var numWarnings = 0;
  for (var error in errors) {
    if (errors[error].severity == 'ERROR') numErrors += 1;
    if (errors[error].severity == 'WARNING') numWarnings += 1;
  }
  return {'ERROR': numErrors, 'WARNING': numWarnings};
}

/**
 * Returns the number of errors that occur in the set of ValidationErrors.
 *
 *
 * @param {Array<ValidationError>} errors Validation errors and/or warnings.
 * @return {number}
 */
function getNumberOfErrors(errors) {
  return getErrorSeverityCounts(errors)['ERROR'];
}

/**
 * Returns the number of warnings that occur in the set of ValidationErrors.
 *
 * @param {Array<ValidationError>} errors Validation errors and/or warnings.
 * @return {number}
 */
function getNumberOfWarnings(errors) {
  return getErrorSeverityCounts(errors)['WARNING'];
}

/**
 * Handles actions to be taken for pages that are on an AMP Cache.
 *
 * @param {integer} tabId ID of a tab.
 * @param {string} ampHref The URL of the AMP page.
 */
function handleAmpCache(tabId, ampHref) {
  updateTabStatus(
      tabId, globals.ampCacheIconPrefix, globals.ampCacheTitle,
      '' /*text*/, globals.ampCacheBgcolor);
  browser.browserAction.onClicked.addListener(
      function loadAmpHref(tab) {
        if (tab.id == tabId) {
          browser.browserAction.onClicked.removeListener(loadAmpHref);
          browser.tabs.sendMessage(tab.id,
              {'loadAmp': true, 'ampHref': ampHref});
        }
      }
  );
}

/**
 * Handles actions to be taken for AMP pages that fail validation.
 *
 * @param {integer} tabId ID of a tab.
 * @param {!Object<!ValidationResult>} validationResult
 */
function handleAmpFail(tabId, validationResult) {
  var numErrors = getNumberOfErrors(validationResult.errors);
  updateTabStatus(
      tabId, globals.invalidAmpIconPrefix, globals.invalidAmpTitle,
      numErrors.toString(), globals.invalidAmpBgcolor);
  updateTabPopup(tabId);
}

/**
 * Handles actions to be taken for pages that have an AMP page available.
 *
 * @param {integer} tabId ID of a tab.
 * @param {string} ampHref The URL of the AMP page.
 */
function handleAmpLink(tabId, ampHref) {
  updateTabStatus(
      tabId, globals.linkToAmpIconPrefix, globals.linkToAmpTitle,
      '' /*text*/, globals.linkToAmpBgColor);
  browser.browserAction.onClicked.addListener(
      function loadAmpHref(tab) {
        if (tab.id == tabId) {
          browser.browserAction.onClicked.removeListener(loadAmpHref);
          browser.tabs.sendMessage(tab.id,
              {'loadAmp': true, 'ampHref': ampHref});
        }
      }
  );
}

/**
 * Handles actions to be taken for AMP pages that pass validation.
 *
 * @param {integer} tabId ID of a tab.
 * @param {!Object<!ValidationResult>} validationResult
 */
function handleAmpPass(tabId, validationResult, canonicalCorrectlyLinksToAmp) {
  var badgeTitle = '';
  var numWarnings = getNumberOfWarnings(validationResult.errors);
  if (numWarnings > 0) badgeTitle = numWarnings.toString();
  updateTabStatus(
      tabId, globals.validAmpIconPrefix, globals.validAmpTitle,
      badgeTitle, globals.validAmpBgcolor);
  if (numWarnings > 0) updateTabPopup(tabId);
}

/**
 * Returns whether the url is forbidden for the extension to act on.
 *
 * @param {string} url The URL of a tab.
 * @return {boolean}
 */
function isForbiddenUrl(url) {
  return (url.startsWith('chrome://') || url.startsWith('view-source'));
}

/**
 * Handles events for a specific tab and asks the tab's content_script to
 * determine AMP details about the page's content.
 *
 * @param {Tab} tab The Tab which triggered the event.
 */
function updateTab(tab) {
  if (!isForbiddenUrl(tab.url))
    browser.tabs.sendMessage(
        tab.id, {'getAmpDetails': true}, function(response) {
          if (response && response.fromAmpCache && response.ampHref) {
            handleAmpCache(tab.id, response.ampHref);
          } else if (response && response.isAmp) {
            validateUrlFromTab(tab, response.canonicalHref);
          } else if (response && !response.isAmp && response.ampHref) {
            handleAmpLink(tab.id, response.ampHref);
          }
        }
    );
}

/**
 * Updates the tabId's extension popup.
 *
 * @param {number} tabId ID of a tab.
 */
function updateTabPopup(tabId) {
  // Verify tab still exists
  browser.tabs.get(tabId, function(tab) {
    if (!browser.runtime.lastError) {
      browser.browserAction.setPopup({tabId: tabId, popup: globals.ampPopup});
    }
  });
}

/**
 * Updates the tabId's extension icon and badge.
 *
 * @param {number} tabId ID of a tab.
 * @param {string} iconPrefix File name prefix of the icon to use.
 * @param {string} title Title to display in extension icon hover.
 * @param {string} text Text to display in badge.
 * @param {string} color Background color for badge.
 */
function updateTabStatus(tabId, iconPrefix, title, text, color) {
  // Verify tab still exists
  browser.tabs.get(tabId, function(tab) {
    if (!browser.runtime.lastError) {
      browser.browserAction.setIcon({path: {"19": iconPrefix + "-128.png",
                                           "38": iconPrefix + "-38.png"},
                                    tabId: tabId});
      if (title !== undefined)
        browser.browserAction.setTitle({title: title, tabId: tabId});
      if (text !== undefined)
        browser.browserAction.setBadgeText({text: text, tabId: tabId});
      if (color !== undefined)
        browser.browserAction.setBadgeBackgroundColor(
            {color: hex2rgba(color), tabId: tabId});
    }
  });
}

/**
 * Fetches the content of the tab's URL and validates it. Then updates the
 * extension's icons with pass/fail.
 *
 * @param {Tab} tab The Tab which triggered the event.
 */
function validateUrlFromTab(tab, canonicalHref) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', tab.url, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      const doc = xhr.responseText;
      const validationResult = amp.validator.validateString(doc);
      // If there exists a corresponding non-AMP document, check if it links
      // back to the AMP document and then report on the AMP document's validity
      if (tab.url.replace(/\.html?$/, '') !== canonicalHref.replace(/\.html?$/, '')) {
        checkIfCanonicalLinksToAmp(tab.url, canonicalHref, function(
            canonicalCorrectlyLinksToAmp) {
          if (!canonicalCorrectlyLinksToAmp) {
            validationResult.status = 'PASS';
            validationResult.errors.push({
              category: null,
              code: 'DOCUMENT_TOO_COMPLEX',
              col: 'N/A',
              dataAmpReportTestValue: null,
              line: 'N/A',
              params: [],
              severity: 'WARNING',
              specUrl: 'https://www.ampproject.org/docs/guides/discovery',
              canonicalHref: canonicalHref
            });
          }
          window.sessionStorage.setItem(tab.url,
              JSON.stringify(validationResult));
          if (validationResult.status == 'PASS') {
            handleAmpPass(tab.id, validationResult,
                canonicalCorrectlyLinksToAmp);
          } else {
            handleAmpFail(tab.id, validationResult);
          }
        });
      // Else if there is just an AMP document, report on its validity
      } else {
        window.sessionStorage.setItem(tab.url, JSON.stringify(
            validationResult));
        if (validationResult.status == 'PASS') {
          handleAmpPass(tab.id, validationResult, true);
        } else {
          handleAmpFail(tab.id, validationResult);
        }
      }
    }
  };
  xhr.send();
}

/**
 * Fetches the content of the canonical URL, checks if a link to the AMP HTML
 * document exists, and if so, whether it is the same as the actual AMP URL
 *
 * @param {string} ampUrlShould The AMP URL that is the expected one.
 * @param {string} canonicalUrl The canonical URL to be checked.
 */
function checkIfCanonicalLinksToAmp(ampUrlShould, canonicalUrl, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    var doc = this.responseXML;
    var ampHtmlLink = doc.querySelector('link[rel="amphtml"]');
    if (ampHtmlLink && ampHtmlLink.href) {
      // The "is"
      var ampBaseUrlIs = ampHtmlLink.href.substring(0,
          ampHtmlLink.href.lastIndexOf('/') + 1);
      var ampUrlIs = new URL(ampHtmlLink.href, ampBaseUrlIs).toString();
      // The "should"
      var ampBaseUrlShould = ampUrlShould.substring(0,
          ampUrlShould.lastIndexOf('/') + 1);
      ampUrlShould = new URL(ampUrlShould, ampBaseUrlShould).toString();
      return callback(ampUrlShould === ampUrlIs);
    }
    return callback(false);
  }
  xhr.open('GET', canonicalUrl);
  xhr.responseType = 'document';
  xhr.send();
}

/**
 * Listen for a new tab being created.
 */
browser.tabs.onCreated.addListener(function(tab) {
  updateTab(tab);
});

/**
 * Listen for a tab being changed.
 */
browser.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  globals.tabToUrl[tabId] = tab.url;
  updateTab(tab);
});

/**
 * Listen for a tab being removed.
 */
browser.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  window.sessionStorage.removeItem(globals.tabToUrl[tabId]);
});

/**
 * Listen for a tab being replaced (due to prerendering or instant).
 */
browser.tabs.onReplaced.addListener(function(addedTabId, removedTabId) {
  window.sessionStorage.removeItem(globals.tabToUrl[removedTabId]);
  browser.tabs.get(addedTabId, function(tab) {
    updateTab(tab);
  });
});
