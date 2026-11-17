/*
  ============================================================
  Popunder script #1 — zones 6091656 and 6091658
  Built on the v20.0.0 popMagic library (a.pemsrv.com / s.pemsrv.com).
  Runs on every page where this file is loaded.
  ============================================================

  FIRING ORDER ACROSS BOTH FILES (one zone at a time, 3 pops each):
    1) zone 6091656  (this file)
    2) zone 6091658  (this file)
    3) zone 5980736  (popunder.js)
    4) zone 5980738  (popunder.js)
  After all four have fired, everything rests ~1 minute and a new
  round starts again from zone 6091656.

  Load this file together with popunder.js on every page. The two files stay in sync
  through the shared gate (see ONE-POP-PER-CLICK, IN-ORDER GATE below).

  Same two fixes as before:
    1) Each zone gets its own independent popMagic instance
       (createPopMagicInstance factory).
    2) only_inline: true on every zone, so the network's hosted
       delivery script is not loaded on top of the inline logic.

  The minified popMagic v20 library below is vendor code, included ONCE
  as a factory. Avoid editing its internals.
*/
(function () {

    // ---- anti-tamper shim (vendor code, unchanged) ----
    function randStr(e, t) {
        for (var n = "", r = t || "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", o = 0; o < e; o++)
            n += r.charAt(Math.floor(Math.random() * r.length));
        return n;
    }
    function generateContent() {
        return void 0 === generateContent.val && (generateContent.val = "document.dispatchEvent(" + randStr(4 * Math.random() + 3) + ");"), generateContent.val;
    }
    try {
        Object.defineProperty(document.currentScript, "innerHTML", { get: generateContent });
        Object.defineProperty(document.currentScript, "textContent", { get: generateContent });
    } catch (e) {}

    // ---- popMagic library v20.0.0 (vendor code, unchanged, wrapped as a factory) ----
    window.document.querySelectorAll||(document.querySelectorAll=document.body.querySelectorAll=Object.querySelectorAll=function(e,o,t,n,i){var r=document,a=r.createStyleSheet();for(i=r.all,o=[],t=(e=e.replace(/\[for\b/gi,"[htmlFor").split(",")).length;t--;){for(a.addRule(e[t],"k:v"),n=i.length;n--;)i[n].currentStyle.k&&o.push(i[n]);a.removeRule(0)}return o});
    function createPopMagicInstance() {
    var popMagic={version:20,cookie_name:"",url:"",config:{},open_count:0,top:null,browser:null,venor_loaded:!1,venor:!1,tcfData:null,gesture:null,touchStart:null,pendingNavigation:null,native_ad_class:".msg-native-widget-item",remoteLicensedDomains:["exdynsrv.com",atob("ZXhvc3J2LmNvbQ=="),atob("ZXhvY2xpY2suY29t"),"opoxv.com","exacdn.com","pemsrv.com"],configTpl:{ads_host:"",syndication_host:"",idzone:"",frequency_period:720,frequency_count:1,trigger_method:1,trigger_class:"",popup_force:!1,popup_fallback:!1,chrome_enabled:!0,new_tab:!1,cat:"",tags:"",el:"",sub:"",sub2:"",sub3:"",block_ad_types:"",only_inline:!1,trigger_delay:0,capping_enabled:!0,tcf_enabled:!1,agego_cross_site_enabled:!0,cookieconsent:!0,should_fire:function(){return!0},on_redirect:null,is_remote:!1,on_venor:null},isAdsDomainLicensed:function(){for(var e=this.config.ads_host,o=this.remoteLicensedDomains.concat([".local","localhost","127.0.0.1"]),t=0;t<o.length;t++){var n=o[t];if("string"==typeof n)if("."===n.charAt(0)){var i=n,r=n.substring(1);if(e.slice(-i.length)===i||e===r)return!0}else{var a=e===n,c="."+n,p=e.slice(-c.length)===c;if(a||p)return!0}}return!1},init:function(e){if(void 0!==e.idzone&&e.idzone){void 0===e.customTargeting&&(e.customTargeting=[]),window.customTargeting=e.customTargeting||null;var o=Object.keys(e.customTargeting).filter(function(e){return e.search("ex_")>=0});for(var t in o.length&&o.forEach(function(e){return this.configTpl[e]=null}.bind(this)),this.configTpl)Object.prototype.hasOwnProperty.call(this.configTpl,t)&&(void 0!==e[t]?this.config[t]=e[t]:this.config[t]=this.configTpl[t]);if(void 0!==this.config.idzone&&""!==this.config.idzone){var n=this,i=!1,r=!1,a=!0,c=function(){!i&&r&&a&&(i=!0,n.preparePop())},p=function(){a=!0,c()};!0!==this.config.only_inline&&!0!==this.config.is_remote&&this.isAdsDomainLicensed()&&(a=!1,this.loadHosted(p),this.addEventToElement(window,"load",p)),this.checkTCFConsent(function(){r=!0,c()})}}},getCountFromCookie:function(){if(!this.config.cookieconsent)return 0;var e=popMagic.getCookie(popMagic.cookie_name),o=void 0===e?0:parseInt(e);return isNaN(o)&&(o=0),o},getLastOpenedTimeFromCookie:function(){var e=popMagic.getCookie(popMagic.cookie_name),o=null;if(e){var t=parseInt(e.split(";")[1]);o=t>0?t:0}return isNaN(o)&&(o=null),o},shouldShow:function(e){if(e=e||!1,!popMagic.config.capping_enabled){var o=!0,t=popMagic.config.should_fire;try{e||"function"!=typeof t||(o=Boolean(t()))}catch(e){console.error("Error executing should fire callback function:",e)}return o&&0===popMagic.open_count}var n=popMagic.getCountFromCookie(),i=popMagic.getLastOpenedTimeFromCookie(),r=Math.floor(Date.now()/1e3),a=i+popMagic.config.trigger_delay;return!(i&&a>r)&&!(n>=popMagic.config.frequency_count)},isCapReached:function(){return popMagic.config.capping_enabled&&popMagic.getCountFromCookie()>=popMagic.config.frequency_count},onVenor:function(e){if("function"==typeof popMagic.config.on_venor)try{popMagic.config.on_venor(e)}catch(e){}},venorShouldShow:function(){return!popMagic.config.capping_enabled||(!popMagic.venor_loaded||"0"===popMagic.venor)},setAsOpened:function(e){var o=e?e.target||e.srcElement:null,t={id:"",tagName:"",classes:"",text:"",href:"",elm:""};void 0!==o&&null!=o&&(t={id:void 0!==o.id&&null!=o.id?o.id:"",tagName:void 0!==o.tagName&&null!=o.tagName?o.tagName:"",classes:void 0!==o.classList&&null!=o.classList?o.classList:"",text:void 0!==o.outerText&&null!=o.outerText?o.outerText:"",href:void 0!==o.href&&null!=o.href?o.href:"",elm:o}),popMagic.gesture={t:Date.now(),link:null!==popMagic.findLinkElement(popMagic.getEventTarget(e))};var n=new CustomEvent("creativeDisplayed-"+popMagic.config.idzone,{detail:t});if(document.dispatchEvent(n),popMagic.config.capping_enabled){var i=popMagic.getCountFromCookie()+1,r=Math.floor(Date.now()/1e3);popMagic.config.cookieconsent&&popMagic.setCookie(popMagic.cookie_name,i+";"+r,popMagic.config.frequency_period)}else++popMagic.open_count},loadHosted:function(e){var o=document.createElement("script");for(var t in o.type="application/javascript",o.async=!0,o.src="//"+this.config.ads_host+"/popunder1000.js",o.id="popmagicldr",this.config)Object.prototype.hasOwnProperty.call(this.config,t)&&"ads_host"!==t&&"syndication_host"!==t&&"on_venor"!==t&&o.setAttribute("data-msg-"+t,this.config[t]);this.addEventToElement(o,"load",e),this.addEventToElement(o,"error",e);var n=document.getElementsByTagName("body").item(0);n.firstChild?n.insertBefore(o,n.firstChild):n.appendChild(o)},preparePop:function(){if(!0===popMagic.config.is_remote||"object"!=typeof msgJsPop101||!Object.prototype.hasOwnProperty.call(msgJsPop101,"add")){if(popMagic.top=self,popMagic.top!==self)try{top.document.location.toString()&&(popMagic.top=top)}catch(e){}if(popMagic.cookie_name="zone-cap-"+popMagic.config.idzone,popMagic.config.capping_enabled||(document.cookie=popMagic.cookie_name+"=;expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/"),!popMagic.isCapReached()){var e=new XMLHttpRequest;e.onreadystatechange=function(){if(e.readyState==XMLHttpRequest.DONE){popMagic.venor_loaded=!0;var o=!1;if(200==e.status){popMagic.venor=e.responseText;try{o="1"===e.getResponseHeader("X-Adscore-Cached")}catch(e){o=!1}}else popMagic.venor="0";popMagic.onVenor(o)}};var o=("https:"!==document.location.protocol&&"http:"!==document.location.protocol?"https:":document.location.protocol)+"//"+popMagic.config.syndication_host+"/venor.php?cookieconsent="+popMagic.config.cookieconsent;!0===popMagic.config.is_remote&&(o+="&pop_cohort=popmagic&idzone="+popMagic.config.idzone),e.open("GET",popMagic.addNuvtValueToUrl(o),!0),e.withCredentials=!0;try{e.send()}catch(e){popMagic.venor_loaded=!0,popMagic.onVenor(!1)}}if(popMagic.buildUrl(),popMagic.browser=popMagic.browserDetector.getBrowserInfo(),popMagic.config.chrome_enabled||!popMagic.browser.isChrome){var t=popMagic.getPopMethod(popMagic.browser);popMagic.addEvents(t),popMagic.prefetchAgToken()}}},getPopMethod:function(e){return popMagic.config.popup_force||popMagic.config.popup_fallback&&e.isChrome&&e.versionNumber>=68&&!e.isMobile?popMagic.methods.popup:e.isMobile?popMagic.methods.default:e.isChrome?popMagic.methods.chromeTab:popMagic.methods.default},checkTCFConsent:function(e){if(this.config.tcf_enabled&&"function"==typeof window.__tcfapi){var o=this;window.__tcfapi("addEventListener",2,function(t,n){n&&(o.tcfData=t,"tcloaded"!==t.eventStatus&&"useractioncomplete"!==t.eventStatus||(window.__tcfapi("removeEventListener",2,function(){},t.listenerId),e()))})}else e()},buildUrl:function(){var e,o="https:"!==document.location.protocol&&"http:"!==document.location.protocol?"https:":document.location.protocol,t=top===self?document.URL:document.referrer,n={type:!0===this.config.is_remote?"remote":"inline",name:"popMagic",ver:this.version},i="";customTargeting&&Object.keys(customTargeting).length&&("object"==typeof customTargeting?Object.keys(customTargeting):customTargeting).forEach(function(o){"object"==typeof customTargeting?e=customTargeting[o]:Array.isArray(customTargeting)&&(e=scriptEl.getAttribute(o));var t=o.replace("data-msg-","").replace(atob("ZGF0YS1leG8t"),"");i+="&"+t+"="+e});var r=this.tcfData&&this.tcfData.gdprApplies&&!0===this.tcfData.gdprApplies?1:0;this.url=o+"//"+this.config.syndication_host+"/v1/link.php?cat="+this.config.cat+"&idzone="+this.config.idzone+"&type=8&p="+encodeURIComponent(t)+"&sub="+this.config.sub+(""!==this.config.sub2?"&sub2="+this.config.sub2:"")+(""!==this.config.sub3?"&sub3="+this.config.sub3:"")+"&block="+(!0===this.config.is_remote?"0":"1")+"&el="+this.config.el+"&tags="+this.config.tags+(""!==this.config.block_ad_types?"&block_ad_types="+this.config.block_ad_types:"")+"&scr_info="+function(e){var o=e.type+"|"+e.name+"|"+e.ver;return encodeURIComponent(btoa(o))}(n)+i+"&gdpr="+r+"&cb="+Math.floor(1e9*Math.random()),this.tcfData&&this.tcfData.tcString?this.url+="&gdpr_consent="+encodeURIComponent(this.tcfData.tcString):this.url+="&cookieconsent="+this.config.cookieconsent},addSuvtValueToUrl:function(e){var o=popMagic.getCookie("__suvt");if(o){var t=-1!==e.indexOf("?")?"&":"?";return e+t+"suvt="+o}return e},addNuvtValueToUrl:function(e){var o=popMagic.getCookie("__nuvt");if(o){var t=-1!==e.indexOf("?")?"&":"?";return e+t+"nuvt="+encodeURIComponent(o)}return e},isAgegoEnabled:function(){return"undefined"!=typeof Promise&&void 0!==window.AGEGO&&!0===this.config.agego_cross_site_enabled},prefetchAgToken:function(){if(popMagic.isAgegoEnabled())try{window.AGEGO("prefetchToken")}catch(e){}},addAgeGoToken:function(e){if(!popMagic.isAgegoEnabled())return Promise.resolve(e);try{var o=window.AGEGO("getTokenUrl",e);return o&&"function"==typeof o.then?o:Promise.resolve(e)}catch(o){return Promise.resolve(e)}},addEventToElement:function(e,o,t){e.addEventListener?e.addEventListener(o,t,!1):e.attachEvent?(e["e"+o+t]=t,e[o+t]=function(){e["e"+o+t](window.event)},e.attachEvent("on"+o,e[o+t])):e["on"+o]=e["e"+o+t]},getTriggerClasses:function(){var e,o=[];-1===popMagic.config.trigger_class.indexOf(",")?e=popMagic.config.trigger_class.split(" "):e=popMagic.config.trigger_class.replace(/\s/g,"").split(",");for(var t=0;t<e.length;t++)""!==e[t]&&o.push("."+e[t]);return o},isNativeAdTarget:function(e){if(!e||"function"!=typeof e.closest)return!1;try{return null!==e.closest(popMagic.native_ad_class)}catch(e){return!1}},addEvents:function(e){var o=function(o){var t=popMagic.getEventTarget(o);!popMagic.isNativeAdTarget(t)&&popMagic.isTriggerTarget(t)&&e.call(this,o)};window.addEventListener?(e!==popMagic.methods.popup&&"firefox"!==popMagic.browser.name&&"ie"!==popMagic.browser.name&&window.addEventListener("mousedown",function(e){0!==e.button||popMagic.isFollowUp()||popMagic.isScrollbarPress(e)||o.call(this,e)},!0),window.addEventListener("click",function(e){popMagic.isFollowUp()?popMagic.endGesture(e):0!==e.button||0===e.clientX&&0===e.clientY||o.call(this,e)},!0),"ontouchstart"in document.documentElement&&(window.addEventListener("touchstart",function(e){var o=e.changedTouches&&e.changedTouches[0];popMagic.touchStart=o&&1===e.touches.length?{x:o.clientX,y:o.clientY,t:Date.now()}:null},!0),window.addEventListener("touchend",function(e){var t=popMagic.touchStart,n=e.changedTouches&&e.changedTouches[0];popMagic.touchStart=null,t&&n&&!popMagic.isFollowUp()&&Math.abs(n.clientX-t.x)<=5&&Math.abs(n.clientY-t.y)<=5&&Date.now()-t.t<500&&o.call(this,e)},!0))):popMagic.addEventToElement(document,"click",o)},isFollowUp:function(){return null!==popMagic.gesture&&Date.now()-popMagic.gesture.t<=1e3},endGesture:function(e){(popMagic.gesture.link||popMagic.pendingNavigation)&&(e.preventDefault(),e.stopPropagation()),popMagic.pendingNavigation&&popMagic.runPendingNavigation()},isScrollbarPress:function(e){var o="BackCompat"===document.compatMode?document.body:document.documentElement;return popMagic.getEventTarget(e)===document.documentElement&&(e.clientX>=o.clientWidth||e.clientY>=o.clientHeight)},getEventTarget:function(e){var o=e?e.target||e.srcElement:null;return o&&3===o.nodeType&&(o=o.parentNode),o},closestMatch:function(e,o){if(!e)return null;if("function"==typeof e.closest)return e.closest(o);for(var t=e.matches||e.msMatchesSelector||e.webkitMatchesSelector;t&&e&&1===e.nodeType;){if(t.call(e,o))return e;e=e.parentNode}return null},isTriggerTarget:function(e){var o=String(popMagic.config.trigger_method);try{if("3"===o)return null!==popMagic.closestMatch(e,"a");if(""==popMagic.config.trigger_class||"2"!==o&&"4"!==o&&"5"!==o)return!0;var t=popMagic.getTriggerClasses();if("2"===o)return null!==popMagic.closestMatch(e,t.join(", "));if("4"===o)return!t.some(function(o){return null!==popMagic.closestMatch(e,o)});var n=popMagic.closestMatch(e,"a"),i=t.map(function(e){return":not("+e+")"}).join("");return null!==n&&popMagic.closestMatch(n,"a"+i)===n}catch(e){return!1}},setCookie:function(e,o,t){if(!this.config.cookieconsent)return!1;t=parseInt(t,10);var n=new Date;n.setMinutes(n.getMinutes()+parseInt(t));var i=encodeURIComponent(o)+"; expires="+n.toUTCString()+"; path=/";document.cookie=e+"="+i},getCookie:function(e){if(!this.config.cookieconsent)return!1;var o,t,n,i=document.cookie.split(";");for(o=0;o<i.length;o++)if(t=i[o].substr(0,i[o].indexOf("=")),n=i[o].substr(i[o].indexOf("=")+1),(t=t.replace(/^\s+|\s+$/g,""))===e)return decodeURIComponent(n)},randStr:function(e,o){for(var t="",n=o||"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",i=0;i<e;i++)t+=n.charAt(Math.floor(Math.random()*n.length));return t},isValidUserEvent:function(e){return!(!("isTrusted"in e)||!e.isTrusted||"ie"===popMagic.browser.name||"safari"===popMagic.browser.name)||0!=e.screenX&&0!=e.screenY},isValidHref:function(e){if(void 0===e||""==e)return!1;return!/\s?javascript\s?:/i.test(e)},findLinkElement:function(e){var o=e;try{for(var t=0;t<20&&!o.getAttribute("href")&&o!==document&&"html"!==o.nodeName.toLowerCase();)o=o.parentNode,t++;return o.getAttribute("href")?o:null}catch(e){return null}},findLinkToOpen:function(e){var o=popMagic.findLinkElement(e),t=!1;if(o){var n=o.getAttribute("target");n&&-1!==n.indexOf("_blank")||(t=o.getAttribute("href"))}return popMagic.isValidHref(t)||(t=!1),t||window.location.href},cancelLinkClick:function(e){void 0!==e.preventDefault&&popMagic.findLinkElement(popMagic.getEventTarget(e))&&(e.preventDefault(),e.stopPropagation())},navigateAfterClick:function(e,o,t){var n=function(){popMagic.isAgegoEnabled()?popMagic.addAgeGoToken(o).then(t):t(o)};"click"!==e.type&&"touchend"!==e.type&&null===popMagic.findLinkElement(popMagic.getEventTarget(e))?(popMagic.pendingNavigation=n,setTimeout(popMagic.runPendingNavigation,1e3)):setTimeout(n,0)},runPendingNavigation:function(){var e=popMagic.pendingNavigation;popMagic.pendingNavigation=null,e&&e()},getPuId:function(){return"ok_"+Math.floor(89999999*Math.random()+1e7)},executeOnRedirect:function(){try{popMagic.config.capping_enabled||"function"!=typeof popMagic.config.on_redirect||popMagic.config.on_redirect()}catch(e){console.error("Error executing on redirect callback:",e)}},followClickedLink:function(e){e!==window.location.href&&(window.location.href=e)},browserDetector:{browserDefinitions:[["firefox",/Firefox\/([0-9.]+)(?:\s|$)/],["opera",/Opera\/([0-9.]+)(?:\s|$)/],["opera",/OPR\/([0-9.]+)(:?\s|$)$/],["edge",/Edg(?:e|)\/([0-9._]+)/],["ie",/Trident\/7\.0.*rv:([0-9.]+)\).*Gecko$/],["ie",/MSIE\s([0-9.]+);.*Trident\/[4-7].0/],["ie",/MSIE\s(7\.0)/],["safari",/Version\/([0-9._]+).*Safari/],["chrome",/(?!Chrom.*Edg(?:e|))Chrom(?:e|ium)\/([0-9.]+)(:?\s|$)/],["chrome",/(?!Chrom.*OPR)Chrom(?:e|ium)\/([0-9.]+)(:?\s|$)/],["bb10",/BB10;\sTouch.*Version\/([0-9.]+)/],["android",/Android\s([0-9.]+)/],["ios",/Version\/([0-9._]+).*Mobile.*Safari.*/],["yandexbrowser",/YaBrowser\/([0-9._]+)/],["crios",/CriOS\/([0-9.]+)(:?\s|$)/]],isChromeOrChromium:function(){var e=window.navigator,o=(e.userAgent||"").toLowerCase(),t=e.vendor||"";if(-1!==o.indexOf("crios"))return!0;if(e.userAgentData&&Array.isArray(e.userAgentData.brands)&&e.userAgentData.brands.length>0){var n=e.userAgentData.brands,i=n.some(function(e){return"Google Chrome"===e.brand}),r=n.some(function(e){return"Chromium"===e.brand})&&2===n.length;return i||r}var a=!!window.chrome,c=-1!==o.indexOf("edg"),p=!!window.opr||-1!==o.indexOf("opr"),s=!(!e.brave||!e.brave.isBrave),g=-1!==o.indexOf("vivaldi"),l=-1!==o.indexOf("yabrowser"),u=-1!==o.indexOf("samsungbrowser"),d=-1!==o.indexOf("ucbrowser");return a&&"Google Inc."===t&&!c&&!p&&!s&&!g&&!l&&!u&&!d},getBrowserInfo:function(){var e=window.navigator.userAgent,o={name:"other",version:"1.0",versionNumber:1,isChrome:this.isChromeOrChromium(),isMobile:!!e.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile|WebOS|Windows Phone/i)};for(var t in this.browserDefinitions){var n=this.browserDefinitions[t];if(n[1].test(e)){var i=n[1].exec(e),r=i&&i[1].split(/[._]/).slice(0,3),a=Array.prototype.slice.call(r,1).join("")||"0";r&&r.length<3&&Array.prototype.push.apply(r,1===r.length?[0,0]:[0]),o.name=n[0],o.version=r.join("."),o.versionNumber=parseFloat(r[0]+"."+a);break}}return o}},methods:{default:function(e){if(!popMagic.shouldShow()||!popMagic.venorShouldShow()||!popMagic.isValidUserEvent(e))return!0;var o=popMagic.findLinkToOpen(popMagic.getEventTarget(e)),t=popMagic.addSuvtValueToUrl(popMagic.url);return window.open(o,"_blank"),popMagic.setAsOpened(e),popMagic.executeOnRedirect(),popMagic.cancelLinkClick(e),popMagic.navigateAfterClick(e,t,function(e){popMagic.top.document.location=e}),!0},chromeTab:function(e){if(!popMagic.shouldShow()||!popMagic.venorShouldShow()||!popMagic.isValidUserEvent(e))return!0;if(void 0===e.preventDefault)return!0;popMagic.cancelLinkClick(e);var o=popMagic.addSuvtValueToUrl(popMagic.url),t=top.window.document.createElement("a");t.href=popMagic.findLinkToOpen(popMagic.getEventTarget(e)),document.getElementsByTagName("body")[0].appendChild(t);var n=new MouseEvent("click",{bubbles:!0,cancelable:!0,view:window,screenX:0,screenY:0,clientX:0,clientY:0,ctrlKey:!0,altKey:!1,shiftKey:!1,metaKey:!0,button:0});n.preventDefault=void 0,t.dispatchEvent(n),t.parentNode.removeChild(t),popMagic.executeOnRedirect(),popMagic.navigateAfterClick(e,o,function(e){window.open(e,"_self")}),popMagic.setAsOpened(e)},popup:function(e){if(!popMagic.shouldShow()||!popMagic.venorShouldShow()||!popMagic.isValidUserEvent(e))return!0;var o="";if(popMagic.config.popup_fallback&&!popMagic.config.popup_force){var t=Math.max(Math.round(.8*window.innerHeight),300);o="menubar=1,resizable=1,width="+Math.max(Math.round(.7*window.innerWidth),300)+",height="+t+",top="+(window.screenY+100)+",left="+(window.screenX+100)}var n=popMagic.addSuvtValueToUrl(popMagic.url),i=popMagic.isAgegoEnabled(),r=window.open(i?"about:blank":n,popMagic.getPuId(),o);if(!r)return!0;try{r.opener=null}catch(e){}var a=popMagic.findLinkToOpen(popMagic.getEventTarget(e));popMagic.setAsOpened(e),popMagic.cancelLinkClick(e);var c=function(){popMagic.executeOnRedirect(),popMagic.followClickedLink(a)};i?popMagic.addAgeGoToken(n).then(function(e){r.location.href=e,c()}):setTimeout(c,0)}}};
        return applyGate(popMagic);
    }

    // ============================================================
    // ONE-POP-PER-CLICK, IN-ORDER GATE
    // Identical copy lives in popunder.js and popunder-v20.js. The two
    // files share state through window.__popGate and a "pop-seq" cookie
    // (so progress also carries over between pages). It does not touch
    // the vendor code — it only wraps two methods on each zone's instance.
    //
    // Firing order:  6091656 -> 6091658 -> 5980736 -> 5980738
    // (the two zones in popunder-v20.js first, then the two in popunder.js)
    //
    // Rules:
    //   1) Only ONE zone is "up next" at any time: the first zone in the
    //      order (present on this page) that has not yet fired its 3 pops
    //      this round. Every other zone is blocked.
    //   2) Progress is counted by the gate itself, so a zone's 1-minute
    //      vendor cookie expiring mid-round can never send the sequence
    //      back to an earlier zone.
    //   3) No two pops within POP_MIN_GAP_MS (stops double-fire per click).
    //   4) Once every zone has fired its 3 pops, everything rests for
    //      POP_REST_MS, then a new round starts from the first zone.
    // ============================================================
    var POP_ORDER = [6091656, 6091658, 5980736, 5980738];
    var POP_CAP = 3;               // pops per zone per round
    var POP_MIN_GAP_MS = 1500;     // never two pops closer together than this
    var POP_REST_MS = 61000;       // rest after a finished round before restarting
    var STATE_COOKIE = "pop-seq";

    window.__popGate = window.__popGate || {};
    window.__popGate.last = window.__popGate.last || 0;
    window.__popGate.present = window.__popGate.present || [];

    function readState() {
        var st = { c: [0, 0, 0, 0], last: 0 };
        var raw = getCookieValue(STATE_COOKIE);
        if (raw) {
            var p = raw.split(".");
            for (var i = 0; i < POP_ORDER.length; i++) {
                var n = parseInt(p[i], 10);
                st.c[i] = isNaN(n) ? 0 : n;
            }
            var l = parseInt(p[POP_ORDER.length], 10);
            st.last = isNaN(l) ? 0 : l;
        }
        return st;
    }

    function writeState(st) {
        var exp = new Date(Date.now() + 24 * 60 * 60 * 1000);
        document.cookie = STATE_COOKIE + "=" + encodeURIComponent(st.c.join(".") + "." + st.last) +
            "; expires=" + exp.toUTCString() + "; path=/";
    }

    function isExhausted(i, st) {
        return st.c[i] >= POP_CAP || getFireCount(POP_ORDER[i]) >= POP_CAP;
    }

    // The one zone allowed to fire right now (null = every zone is done for this round).
    function nextZone(st) {
        for (var i = 0; i < POP_ORDER.length; i++) {
            if (window.__popGate.present.indexOf(POP_ORDER[i]) !== -1 && !isExhausted(i, st)) {
                return POP_ORDER[i];
            }
        }
        return null;
    }

    function applyGate(pm) {
        var origShouldShow = pm.shouldShow;
        var origSetAsOpened = pm.setAsOpened;

        pm.shouldShow = function (isSetupCheck) {
            // The library calls shouldShow(true) internally during setup — leave that alone.
            if (isSetupCheck) return origShouldShow.apply(pm, arguments);

            var now = Date.now();
            if (now - window.__popGate.last < POP_MIN_GAP_MS) return false;

            var st = readState();
            var next = nextZone(st);
            if (next === null && now - st.last >= POP_REST_MS) {
                st = { c: [0, 0, 0, 0], last: 0 };   // rest is over: start a new round
                writeState(st);
                next = nextZone(st);
            }
            if (next === null || next !== Number(pm.config.idzone)) return false;

            return origShouldShow.apply(pm, arguments);
        };

        pm.setAsOpened = function () {
            var st = readState();
            var i = POP_ORDER.indexOf(Number(pm.config.idzone));
            if (i !== -1) st.c[i]++;
            st.last = Date.now();
            writeState(st);
            window.__popGate.last = st.last;
            return origSetAsOpened.apply(pm, arguments);
        };

        return pm;
    }

    // ============================================================
    // ORCHESTRATION — zones 6091656 and 6091658 (v20)
    // The gate above decides which single zone may fire, so every zone
    // here is simply armed at start; no per-zone chaining is needed.
    // ============================================================
    var zoneChain = [
        {
            ads_host: "a.pemsrv.com", syndication_host: "s.pemsrv.com", idzone: 6091656,
            popup_fallback: false, popup_force: false, chrome_enabled: true, new_tab: false,
            frequency_period: 1, frequency_count: 3, trigger_method: 1, trigger_class: "",
            trigger_delay: 0, capping_enabled: true, tcf_enabled: true,
            agego_cross_site_enabled: true, only_inline: true
        },
        {
            ads_host: "a.pemsrv.com", syndication_host: "s.pemsrv.com", idzone: 6091658,
            popup_fallback: false, popup_force: false, chrome_enabled: true, new_tab: false,
            frequency_period: 1, frequency_count: 3, trigger_method: 1, trigger_class: "",
            trigger_delay: 0, capping_enabled: true, tcf_enabled: true,
            agego_cross_site_enabled: true, only_inline: true
        },
    ];

    function getCookieValue(name) {
        var pattern = "(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, "\\$1") + "=([^;]*)";
        var match = document.cookie.match(new RegExp(pattern));
        return match ? decodeURIComponent(match[1]) : null;
    }

    function getFireCount(idzone) {
        var raw = getCookieValue("zone-cap-" + idzone);
        var count = raw ? parseInt(raw.split(";")[0], 10) : 0;
        return isNaN(count) ? 0 : count;
    }

    // Tell the gate which zones exist on this page.
    for (var z = 0; z < zoneChain.length; z++) {
        if (window.__popGate.present.indexOf(zoneChain[z].idzone) === -1) {
            window.__popGate.present.push(zoneChain[z].idzone);
        }
    }

    // ---- START DELAY (only on pages where the intro layer appears) ----
    // Pages with an intro: zones wait this many seconds after the page has fully loaded.
    // Pages without an intro: zones start immediately.
    var DELAY_WHEN_INTRO_SECONDS = 15;

    function startZones() {
        for (var i = 0; i < zoneChain.length; i++) {
            createPopMagicInstance().init(zoneChain[i]);
        }
    }

    if (window.__introActive) {
        var scheduleStart = function () {
            setTimeout(startZones, DELAY_WHEN_INTRO_SECONDS * 1000);
        };
        if (document.readyState === "complete") {
            scheduleStart();
        } else {
            window.addEventListener("load", scheduleStart);
        }
    } else {
        startZones();
    }
})();