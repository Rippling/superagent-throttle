'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * ## default options
 */
var defaults = {
  // start unpaused ?
  active: true,
  // requests per `ratePer` ms
  rate: 40,
  // ms per `rate` requests
  ratePer: 40000,
  // max concurrent requests
  concurrent: 20,
  // Enable/Disable cross-tab concurrency
  acrossTabs: false,
  // Will be used while storing data in localStorage
  tabIdPrefix: '_tab',
  // If `recentActionAt` is `tabExpire` ms old, assume it's dead. So ignore it's concurrency
  tabExpire: 60 * 1000

  /**
   * ## Throttle
   * The throttle object.
   *
   * @class
   * @param {object} options - key value options
   */
};
var Throttle = function (_EventEmitter) {
  _inherits(Throttle, _EventEmitter);

  function Throttle(options) {
    _classCallCheck(this, Throttle);

    // instance properties
    var _this = _possibleConstructorReturn(this, (Throttle.__proto__ || Object.getPrototypeOf(Throttle)).call(this));

    _this._options({
      _requestTimes: [0],
      _buffer: [],
      _serials: {},
      _timeout: false
    });
    _this._options(defaults);
    _this._options(options);

    if (!_this.isLocalStorageEnabled()) {
      _this._options({ acrossTabs: false });
    } else {
      _this._initAcrossTabs();
    }
    return _this;
  }

  _createClass(Throttle, [{
    key: 'isLocalStorageEnabled',
    value: function isLocalStorageEnabled() {
      try {
        if (typeof window !== 'undefined') {
          return !!window.localStorage;
        }
        return false;
      } catch (e) {
        return false;
      }
    }

    /**
     * ## _options
     * updates options on instance
     *
     * @method
     * @param {Object} options - key value object
     * @returns null
     */

  }, {
    key: '_options',
    value: function _options(options) {
      for (var property in options) {
        if (options.hasOwnProperty(property)) {
          this[property] = options[property];
        }
      }
    }

    /**
     * ## _initAcrossTabs
     * Setup cross-tab concurrency feature
     */

  }, {
    key: '_initAcrossTabs',
    value: function _initAcrossTabs() {
      this._tabId = this.tabIdPrefix + '.' + Date.now();
      this.setCurrent(0);
      this.clearOld();
      function onUnload() {
        window.localStorage.removeItem(this._tabId);
      }
      // clear localStorage
      window.addEventListener('unload', onUnload.bind(this));
    }

    /**
     * ## options
     * thin wrapper for _options
     *
     *  * calls `this.cycle()`
     *  * adds alternate syntax
     *
     * alternate syntax:
     * throttle.options('active', true)
     * throttle.options({active: true})
     *
     * @method
     * @param {Object} options - either key value object or keyname
     * @param {Mixed} [value] - value for key
     * @returns null
     */

  }, {
    key: 'options',
    value: function options(_options2, value) {
      if (typeof _options2 === 'string' && value) {
        _options2 = { options: value };
      }
      this._options(_options2);
      this.cycle();
    }

    /**
     * ## setCurrent
     * Sets concurrency count in localStorage
     *
     * @param {Number} current concurrency count
     */

  }, {
    key: 'setCurrent',
    value: function setCurrent(current) {
      var value = {
        current: current,
        recentActionAt: Date.now() // Always update action timestamp
      };
      window.localStorage.setItem(this._tabId, JSON.stringify(value));
    }

    /**
     * clear Tab Data older than 7 days 
     */

  }, {
    key: 'clearOld',
    value: function clearOld() {
      var days = 7; // Days you want to subtract
      var referenceTime = Date.now() - days * 24 * 60 * 60 * 1000;
      for (var key in window.localStorage) {
        if (Object.hasOwnProperty.call(window.localStorage, key) && key.indexOf(this.tabIdPrefix) === 0) {
          var tabData = window.localStorage.getItem(key);
          var tabDate = Number(key.split('.')[1]);
          if (tabDate < referenceTime) {
            window.localStorage.removeItem(key);
          }
        }
      }
    }

    /**
     * ## getCurrent
     * Computes current concurrency level
     */

  }, {
    key: 'getCurrent',
    value: function getCurrent() {
      var current = 0;
      for (var key in window.localStorage) {
        if (Object.hasOwnProperty.call(window.localStorage, key) && key.indexOf(this.tabIdPrefix) === 0) {
          var tabData = window.localStorage.getItem(key);

          try {
            if (!tabData) {
              console.assert(false, 'tabData structure mis-matched: ' + JSON.stringify(tabData));
              throw new Error('catch me');
            }
            tabData = JSON.parse(tabData);
          } catch (ex) {
            continue;
          }
          // Check whether other tabs are dead or not. If dead, ignore their concurrency count
          if (key !== this._tabId && tabData.recentActionAt < Date.now() - this.tabExpire) {
            continue;
          }
          current += tabData.current;
        }
      }
      return current;
    }

    /**
     * Updates current tab concurrency by adding/substracting the current count
     * @param {Number} value - Negative/Positive number
     */

  }, {
    key: 'addAndSetCurrent',
    value: function addAndSetCurrent(value) {
      var tabData = window.localStorage.getItem(this._tabId);
      // If tabData is null/undefined, It means the tab is about to unload/close.
      if (tabData === null || tabData === undefined) {
        return 0;
      }
      tabData = JSON.parse(tabData);
      var current = tabData.current;
      this.setCurrent(current + value);
      return current + value;
    }

    /**
     * ## next
     * checks whether instance has available capacity and calls throttle.send()
     *
     * @returns {Boolean}
     */

  }, {
    key: 'next',
    value: function next() {
      var throttle = this;
      // make requestTimes `throttle.rate` long. Oldest request will be 0th index
      throttle._requestTimes = throttle._requestTimes.slice(throttle.rate * -1);

      if (
      // paused
      !throttle.active ||
      // at concurrency limit
      throttle.getCurrent() >= throttle.concurrent ||
      // less than `ratePer`
      throttle._isRateBound() ||
      // something waiting in the throttle
      !throttle._buffer.length) {
        return false;
      }
      var idx = throttle._buffer.findIndex(function (request) {
        return !request.serial || !throttle._serials[request.serial];
      });
      if (idx === -1) {
        throttle._isSerialBound = true;
        return false;
      }
      throttle.send(throttle._buffer.splice(idx, 1)[0]);
      return true;
    }

    /**
     * ## serial
     * updates throttle.\_serials and throttle.\_isRateBound
     *
     * serial subthrottles allow some requests to be serialised, whilst maintaining
     * their place in the queue. The _serials structure keeps track of what serial
     * queues are waiting for a response.
     *
     * ```
     * throttle._serials = {
     *   'example.com/end/point': true,
     *   'example.com/another': false
     * }
     * ```
     *
     * @param {Request} request superagent request
     * @param {Boolean} state new state for serial
     */

  }, {
    key: 'serial',
    value: function serial(request, state) {
      var serials = this._serials;
      var throttle = this;
      if (request.serial === false) {
        return;
      }
      if (state === undefined) {
        return serials[request.serial];
      }
      if (state === false) {
        throttle._isSerialBound = false;
      }
      serials[request.serial] = state;
    }

    /**
     * ## _isRateBound
     * returns true if throttle is bound by rate
     *
     * @returns {Boolean}
     */

  }, {
    key: '_isRateBound',
    value: function _isRateBound() {
      var throttle = this;
      return Date.now() - throttle._requestTimes[0] < throttle.ratePer && throttle._buffer.length > 0;
    }

    /**
     * ## cycle
     * an iterator of sorts. Should be called when
     *
     *  - something added to throttle (check if it can be sent immediately)
     *  - `ratePer` ms have elapsed since nth last call where n is `rate` (may have
     *    available rate)
     *  - some request has ended (may have available concurrency)
     *
     * @param {Request} request the superagent request
     * @returns null
     */

  }, {
    key: 'cycle',
    value: function cycle(request) {
      var throttle = this;
      if (request) {
        throttle._buffer.push(request);
      }
      clearTimeout(throttle._timeout);

      // fire requests
      // throttle.next will return false if there's no capacity or throttle is
      // drained
      while (throttle.next()) {}

      // if bound by rate, set timeout to reassess later.
      if (throttle._isRateBound()) {
        var timeout = void 0;
        // defined rate
        timeout = throttle.ratePer;
        // less ms elapsed since oldest request
        timeout -= Date.now() - throttle._requestTimes[0];
        // plus 1 ms to ensure you don't fire a request exactly ratePer ms later
        timeout += 1;
        throttle._timeout = setTimeout(function () {
          throttle.cycle();
        }, timeout);
      }
    }

    /**
     * ## send
     *
     * sends a queued request.
     *
     * @param {Request} request superagent request
     * @returns null
     */

  }, {
    key: 'send',
    value: function send(request) {
      var throttle = this;
      throttle.serial(request, true);

      // declare callback within this enclosure, for access to throttle & request
      function cleanup(err, response) {
        throttle.addAndSetCurrent(-1);
        if (err && _events2.default.listenerCount(throttle, 'error')) {
          throttle.emit('error', response);
        }
        throttle.emit('received', request);

        if (!throttle._buffer.length && !throttle.getCurrent()) {
          throttle.emit('drained');
        }
        throttle.serial(request, false);
        throttle.cycle();
        // original `callback` was stored at `request._maskedCallback`
        request._maskedCallback(err, response);
      }

      // original `request.end` was stored at `request._maskedEnd`
      request._maskedEnd(cleanup);
      throttle._requestTimes.push(Date.now());
      throttle.addAndSetCurrent(1);
      this.emit('sent', request);
    }

    /**
     * ## plugin
     *
     * `superagent` `use` function should refer to this plugin method a la
     * `.use(throttle.plugin())`
     *
     * mask the original `.end` and store the callback passed in
     *
     * @method
     * @param {string} serial any string is ok, it's just a namespace
     * @returns null
     */

  }, {
    key: 'plugin',
    value: function plugin(serial) {
      var throttle = this;
      // let patch = function(request) {
      return function (request) {
        request.throttle = throttle;
        request.serial = serial || false;
        // replace request.end
        request._maskedEnd = request.end;
        request.end = function (callback) {
          // store callback as superagent does
          request._maskedCallback = callback || function () {};
          // place this request in the queue
          request.throttle.cycle(request);
          return request;
        };
        return request;
      };
    }
  }]);

  return Throttle;
}(_events2.default);

module.exports = Throttle;