(function (window, document) {
  'use strict';

  if (!window || !document) {
    return;
  }

  var cfg = (window.PACKED_TRACK && typeof window.PACKED_TRACK === 'object')
    ? window.PACKED_TRACK
    : {};

  var metaPixelId = (typeof cfg.metaPixelId === 'string')
    ? cfg.metaPixelId.replace(/^\s+|\s+$/g, '')
    : '';
  var clarityId = (typeof cfg.clarityId === 'string')
    ? cfg.clarityId.replace(/^\s+|\s+$/g, '')
    : '';
  var currency = (typeof cfg.currency === 'string' && cfg.currency)
    ? cfg.currency
    : 'AUD';
  var items = (cfg.items && typeof cfg.items === 'object')
    ? cfg.items
    : {};

  var fired = [];
  window.PackedTrack = { _fired: fired };

  function injectScript(src) {
    var t = document.createElement('script');
    t.async = true;
    t.src = src;
    var scripts = document.getElementsByTagName ? document.getElementsByTagName('script') : null;
    var first = scripts && scripts.length ? scripts[0] : null;
    if (first && first.parentNode) {
      first.parentNode.insertBefore(t, first);
    } else if (document.head && document.head.appendChild) {
      document.head.appendChild(t);
    } else if (document.documentElement && document.documentElement.appendChild) {
      document.documentElement.appendChild(t);
    }
  }

  function trackEvent(name, params, options) {
    var record = { name: name };
    if (params !== undefined) {
      record.params = params;
    }
    if (options !== undefined) {
      record.options = options;
    }
    fired.push(record);

    if (metaPixelId && typeof window.fbq === 'function') {
      if (options !== undefined) {
        window.fbq('track', name, params, options);
      } else if (params !== undefined) {
        window.fbq('track', name, params);
      } else {
        window.fbq('track', name);
      }
    }
  }

  function initMetaPixel(id) {
    if (!window.fbq) {
      var n = function () {
        if (n.callMethod) {
          n.callMethod.apply(n, arguments);
        } else {
          n.queue.push(arguments);
        }
      };
      window.fbq = n;
      if (!window._fbq) {
        window._fbq = n;
      }
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      injectScript('https://connect.facebook.net/en_US/fbevents.js');
    }
    window.fbq('init', id);
    trackEvent('PageView');
  }

  function initClarity(id) {
    window.clarity = window.clarity || function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
    injectScript('https://www.clarity.ms/tag/' + encodeURIComponent(id));
  }

  function getAttr(el, attrName, datasetKey) {
    if (!el) {
      return null;
    }
    if (typeof el.getAttribute === 'function') {
      var val = el.getAttribute(attrName);
      if (val !== null && val !== undefined) {
        return String(val);
      }
    }
    if (datasetKey && el.dataset && el.dataset[datasetKey] !== undefined && el.dataset[datasetKey] !== null) {
      return String(el.dataset[datasetKey]);
    }
    return null;
  }

  function hasAttr(el, attrName, datasetKey) {
    if (!el) {
      return false;
    }
    if (typeof el.hasAttribute === 'function' && el.hasAttribute(attrName)) {
      return true;
    }
    if (typeof el.getAttribute === 'function' && el.getAttribute(attrName) !== null) {
      return true;
    }
    if (datasetKey && el.dataset && Object.prototype.hasOwnProperty.call(el.dataset, datasetKey)) {
      return true;
    }
    return false;
  }

  function parseQuery(search) {
    var out = {};
    if (!search || typeof search !== 'string') {
      return out;
    }
    var qs = search.charAt(0) === '?' ? search.slice(1) : search;
    if (!qs) {
      return out;
    }
    var parts = qs.split('&');
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) {
        continue;
      }
      var eq = part.indexOf('=');
      var k = eq === -1 ? part : part.slice(0, eq);
      var v = eq === -1 ? '' : part.slice(eq + 1);
      try {
        k = decodeURIComponent(k.replace(/\+/g, ' '));
        v = decodeURIComponent(v.replace(/\+/g, ' '));
      } catch (err) {
        // Keep raw strings if percent-encoding is malformed.
      }
      out[k] = v;
    }
    return out;
  }

  function handleViewContent(body) {
    var productId = getAttr(body, 'data-product-id', 'productId');
    var price = getAttr(body, 'data-price', 'price');
    if (productId && price !== null && price !== '') {
      var numPrice = Number(price);
      if (!isNaN(numPrice)) {
        trackEvent('ViewContent', {
          content_ids: [productId],
          content_type: 'product',
          value: numPrice,
          currency: currency
        });
      }
    }
  }

  function handlePurchase(body) {
    if (getAttr(body, 'data-page', 'page') !== 'thanks') {
      return;
    }
    var search = (window.location && typeof window.location.search === 'string')
      ? window.location.search
      : '';
    var query = parseQuery(search);
    var sessionId = query.session_id || '';
    var itemKey = query.item || '';

    if (!sessionId || !itemKey) {
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(items, itemKey)) {
      return;
    }
    var item = items[itemKey];
    if (!item || typeof item !== 'object') {
      return;
    }

    var storageKey = 'pt_purchase_' + sessionId;
    var alreadyFired = false;
    try {
      if (window.localStorage && window.localStorage.getItem(storageKey)) {
        alreadyFired = true;
      }
    } catch (e) {
      alreadyFired = false;
    }

    if (alreadyFired) {
      return;
    }

    trackEvent(
      'Purchase',
      {
        content_ids: [item.id],
        content_type: 'product',
        value: Number(item.value),
        currency: currency
      },
      { eventID: sessionId }
    );

    try {
      if (window.localStorage) {
        window.localStorage.setItem(storageKey, '1');
      }
    } catch (e) {
      // Ignore storage write failures.
    }
  }

  function findCheckoutAnchor(target) {
    var node = target;
    while (node && node !== document) {
      if (node.tagName && String(node.tagName).toUpperCase() === 'A' && hasAttr(node, 'data-checkout', 'checkout')) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  if (metaPixelId) {
    initMetaPixel(metaPixelId);
  }
  if (clarityId) {
    initClarity(clarityId);
  }

  if (typeof document.addEventListener === 'function') {
    document.addEventListener('click', function (e) {
      if (!e || !e.target) {
        return;
      }
      var anchor = findCheckoutAnchor(e.target);
      if (!anchor) {
        return;
      }
      var productId = getAttr(anchor, 'data-product-id', 'productId') || '';
      var price = getAttr(anchor, 'data-price', 'price');
      trackEvent('InitiateCheckout', {
        content_ids: [productId],
        value: Number(price),
        currency: currency,
        num_items: 1
      });
    });
  }

  function initBodyEvents() {
    if (!document.body) {
      return;
    }
    handleViewContent(document.body);
    handlePurchase(document.body);
  }

  if (document.body) {
    initBodyEvents();
  } else if (typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', initBodyEvents);
  }
})(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null);
