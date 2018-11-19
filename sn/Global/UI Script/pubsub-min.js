/* 
 * Application : Global
 * ClassName   : sys_ui_script
 * Created On  : 2016-02-03 14:39:48
 * Created By  : kevin.anderson
 * Updated On  : 2016-07-07 14:02:57
 * Updated By  : kevin.anderson
 * URL         : - /sys_ui_script.do?sys_id=718c642a0f1d5600a95eb97ce1050ec2
 */
/*
Copyright (c) 2010,2011,2012,2013,2014 Morgan Roderick http://roderick.dk 
License: MIT - http://mrgnrdrck.mit-license.org
Dependency free publish/subscribe for JavaScript
https://github.com/mroderick/PubSubJS
*/
!function(n,t){"use strict";"function"==typeof define&&define.amd?define(["exports"],t):"object"==typeof exports&&t(exports);var r={};n.PubSub=r,t(r)}("object"==typeof window&&window||this,function(n){"use strict";function t(n){var t;for(t in n)if(n.hasOwnProperty(t))return!0;return!1}function r(n){return function(){throw n}}function e(n,t,e){try{n(t,e)}catch(i){setTimeout(r(i),0)}}function i(n,t,r){n(t,r)}function o(n,t,r,o){var f,u=c[t],s=o?i:e;if(c.hasOwnProperty(t))for(f in u)u.hasOwnProperty(f)&&s(u[f],n,r)}function f(n,t,r){return function(){var e=String(n),i=e.lastIndexOf(".");for(o(n,n,t,r);-1!==i;)e=e.substr(0,i),i=e.lastIndexOf("."),o(n,e,t,r)}}function u(n){for(var r=String(n),e=Boolean(c.hasOwnProperty(r)&&t(c[r])),i=r.lastIndexOf(".");!e&&-1!==i;)r=r.substr(0,i),i=r.lastIndexOf("."),e=Boolean(c.hasOwnProperty(r)&&t(c[r]));return e}function s(n,t,r,e){var i=f(n,t,e),o=u(n);return o?(r===!0?i():setTimeout(i,0),!0):!1}var c={},a=-1;n.publish=function(t,r){return s(t,r,!1,n.immediateExceptions)},n.publishSync=function(t,r){return s(t,r,!0,n.immediateExceptions)},n.subscribe=function(n,t){if("function"!=typeof t)return!1;c.hasOwnProperty(n)||(c[n]={});var r="uid_"+String(++a);return c[n][r]=t,r},n.clearAllSubscriptions=function(){c={}},n.clearSubscriptions=function(n){var t;for(t in c)c.hasOwnProperty(t)&&0===t.indexOf(n)&&delete c[t]},n.unsubscribe=function(n){var t,r,e,i="string"==typeof n&&c.hasOwnProperty(n),o=!i&&"string"==typeof n,f="function"==typeof n,u=!1;if(i)return void delete c[n];for(t in c)if(c.hasOwnProperty(t)){if(r=c[t],o&&r[n]){delete r[n],u=n;break}if(f)for(e in r)r.hasOwnProperty(e)&&r[e]===n&&(delete r[e],u=!0)}return u}});
