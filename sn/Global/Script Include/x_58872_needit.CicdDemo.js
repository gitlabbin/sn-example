/* 
 * Application : Global
 * ClassName   : sys_script_include
 * Created On  : 2018-11-13 04:05:21
 * Created By  : admin
 * Updated On  : 2018-11-13 04:05:21
 * Updated By  : admin
 * URL         : - /sys_script_include.do?sys_id=ff9754f8db7d2300f526d426ca9619dd
 */
/**
 * Class Description
 * 
 * @class 
 * @author Boris Moers
 * @memberof global.module:sys_script_include
 */
var CicdDemo = Class.create();
CicdDemo.prototype = /** @lends global.module:sys_script_include.CicdDemo.prototype */ {
    /**
     * Constructor
     * 
     * @returns {undefined}
     */
    initialize: function () { 
        
    },

    /**
     * A test function
     * 
     * @param {any} string the string to test
     * @returns {boolean} a true boolean
     */
    test: function (string) {

        return true;
    },
    type: 'CicdDemo'
};