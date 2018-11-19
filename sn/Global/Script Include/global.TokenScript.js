/* 
 * Application : Global
 * ClassName   : sys_script_include
 * Created On  : 2018-11-19 01:10:46
 * Created By  : admin
 * Updated On  : 2018-11-19 01:10:46
 * Updated By  : admin
 * URL         : - /sys_script_include.do?sys_id=a049e62adb312300f526d426ca9619e9
 */
var TokenScript = Class.create();
TokenScript.prototype = {
	initialize: function() {
		var now = new GlideDateTime(),
		oauth = new GlideRecord('oauth_credential');
		now.addSeconds((30 * 24 * 60 * 60)); // token valid for 30 min only (30 * 60)! 1month 30 * 24 * 60 * 60
		
		// create a token
		var token = "",
		chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
		for (var i = 0; i < 86; i++) {
			token += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		
		oauth.setValue('peer', 'be57bb02533102006b0fc91a8dc5877c'); // ServiceNow Mobile App - for testing
		oauth.setValue('token', token);
		oauth.setValue('user', '6816f79cc0a8016401c5a33be04be441'); // admin
		oauth.expires = now;
		oauth.setValue('scopes', 'useraccount');
		oauth.setValue('type', 'access_token');
		oauth.setValue('client_id', '3e57bb02663102004d010ee8f561307a'); // ServiceNow Mobile App - for testing
		oauth.insert();
		gs.info("Use this token to connect {0}", token);
		},
		
		type: 'TokenScript'
	};