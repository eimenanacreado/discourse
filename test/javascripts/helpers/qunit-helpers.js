import { isEmpty } from "@ember/utils";
import { later } from "@ember/runloop";
/* global QUnit, resetSite */

import sessionFixtures from "fixtures/session-fixtures";
import HeaderComponent from "discourse/components/site-header";
import { forceMobile, resetMobile } from "discourse/lib/mobile";
import { resetPluginApi } from "discourse/lib/plugin-api";
import {
  clearCache as clearOutletCache,
  resetExtraClasses
} from "discourse/lib/plugin-connectors";
import { clearHTMLCache } from "discourse/helpers/custom-html";
import { flushMap } from "discourse/models/store";
import { clearRewrites } from "discourse/lib/url";
import { initSearchData } from "discourse/widgets/search-menu";
import { resetDecorators } from "discourse/widgets/widget";
import { resetWidgetCleanCallbacks } from "discourse/components/mount-widget";
import { resetTopicTitleDecorators } from "discourse/components/topic-title";
import { resetDecorators as resetPostCookedDecorators } from "discourse/widgets/post-cooked";
import { resetDecorators as resetPluginOutletDecorators } from "discourse/components/plugin-connector";
import { resetUsernameDecorators } from "discourse/helpers/decorate-username-selector";
import { resetCache as resetOneboxCache } from "pretty-text/oneboxer";
import { resetCustomPostMessageCallbacks } from "discourse/controllers/topic";
import { _clearSnapshots } from "select-kit/components/composer-actions";
import User from "discourse/models/user";

export function currentUser() {
  return User.create(sessionFixtures["/session/current.json"].current_user);
}

export function updateCurrentUser(properties) {
  User.current().setProperties(properties);
}

// Note: do not use this in acceptance tests. Use `loggedIn: true` instead
export function logIn() {
  User.resetCurrent(currentUser());
}

// Note: Only use if `loggedIn: true` has been used in an acceptance test
export function loggedInUser() {
  return User.current();
}

export function fakeTime(timeString, timezone = null, advanceTime = false) {
  let now = moment.tz(timeString, timezone);
  return sandbox.useFakeTimers({
    now: now.valueOf(),
    shouldAdvanceTime: advanceTime
  });
}

export async function acceptanceUseFakeClock(
  timeString,
  callback,
  timezone = null
) {
  if (!timezone) {
    let user = loggedInUser();
    if (user) {
      timezone = user.resolvedTimezone(user);
    } else {
      timezone = "America/Denver";
    }
  }
  let clock = fakeTime(timeString, timezone, true);
  await callback();
  clock.reset();
}

const Plugin = $.fn.modal;
const Modal = Plugin.Constructor;

function AcceptanceModal(option, _relatedTarget) {
  return this.each(function() {
    var $this = $(this);
    var data = $this.data("bs.modal");
    var options = $.extend(
      {},
      Modal.DEFAULTS,
      $this.data(),
      typeof option === "object" && option
    );

    if (!data) $this.data("bs.modal", (data = new Modal(this, options)));
    data.$body = $("#ember-testing");

    if (typeof option === "string") data[option](_relatedTarget);
    else if (options.show) data.show(_relatedTarget);
  });
}

window.bootbox.$body = $("#ember-testing");
$.fn.modal = AcceptanceModal;

let _pretenderCallbacks = {};

export function applyPretender(name, server, helper) {
  const cb = _pretenderCallbacks[name];
  if (cb) cb(server, helper);
}

export function acceptance(name, options) {
  options = options || {};

  if (options.pretend) {
    _pretenderCallbacks[name] = options.pretend;
  }

  QUnit.module("Acceptance: " + name, {
    beforeEach() {
      resetMobile();

      // For now don't do scrolling stuff in Test Mode
      HeaderComponent.reopen({ examineDockHeader: function() {} });

      resetExtraClasses();
      if (options.beforeEach) {
        options.beforeEach.call(this);
      }

      if (options.mobileView) {
        forceMobile();
      }

      if (options.loggedIn) {
        logIn();
      }

      if (options.settings) {
        Discourse.SiteSettings = jQuery.extend(
          true,
          Discourse.SiteSettings,
          options.settings
        );
      }

      if (options.site) {
        resetSite(Discourse.SiteSettings, options.site);
      }

      clearOutletCache();
      clearHTMLCache();
      resetPluginApi();
      Discourse.reset();
    },

    afterEach() {
      if (options && options.afterEach) {
        options.afterEach.call(this);
      }
      flushMap();
      localStorage.clear();
      User.resetCurrent();
      resetSite(Discourse.SiteSettings);
      resetExtraClasses();
      clearOutletCache();
      clearHTMLCache();
      resetPluginApi();
      clearRewrites();
      initSearchData();
      resetDecorators();
      resetPostCookedDecorators();
      resetPluginOutletDecorators();
      resetTopicTitleDecorators();
      resetUsernameDecorators();
      resetOneboxCache();
      resetCustomPostMessageCallbacks();
      _clearSnapshots();
      Discourse._runInitializer("instanceInitializers", function(
        initName,
        initializer
      ) {
        if (initializer && initializer.teardown) {
          initializer.teardown(Discourse.__container__);
        }
      });
      Discourse.reset();

      // We do this after reset so that the willClearRender will have already fired
      resetWidgetCleanCallbacks();
    }
  });
}

export function controllerFor(controller, model) {
  controller = Discourse.__container__.lookup("controller:" + controller);
  if (model) {
    controller.set("model", model);
  }
  return controller;
}

export function fixture(selector) {
  if (selector) {
    return $("#qunit-fixture").find(selector);
  }
  return $("#qunit-fixture");
}

QUnit.assert.not = function(actual, message) {
  this.pushResult({
    result: !actual,
    actual,
    expected: !actual,
    message
  });
};

QUnit.assert.blank = function(actual, message) {
  this.pushResult({
    result: isEmpty(actual),
    actual,
    message
  });
};

QUnit.assert.present = function(actual, message) {
  this.pushResult({
    result: !isEmpty(actual),
    actual,
    message
  });
};

QUnit.assert.containsInstance = function(collection, klass, message) {
  const result = klass.detectInstance(_.first(collection));
  this.pushResult({
    result,
    message
  });
};

export function waitFor(assert, callback, timeout) {
  timeout = timeout || 500;

  const done = assert.async();
  later(() => {
    callback();
    done();
  }, timeout);
}
