/* 
 * Application : Global
 * ClassName   : sys_script_client
 * Created On  : 2018-11-13 05:15:46
 * Created By  : admin
 * Updated On  : 2018-11-13 05:34:04
 * Updated By  : admin
 * URL         : - /sys_script_client.do?sys_id=c187acf4dbbd2300f526d426ca9619d9
 */
function onChange(control, oldValue, newValue, isLoading, isTemplate) {
	if (isLoading || newValue !== 'complete') {
		return;
	}
	
	//Type appropriate comment here, and begin script below
	try {
		var r = new sn_ws.RESTMessageV2('CICDMessage', 'POST');
		
		//override authentication profile
		//authentication type ='basic'/ 'oauth2'
		//r.setAuthentication(authentication type, profile name);
		
		//set a MID server name if one wants to run the message on MID
		//r.setMIDServer('MY_MID_SERVER');
		
		//if the message is configured to communicate through ECC queue, either
		//by setting a MID server or calling executeAsync, one needs to set skip_sensor
		//to true. Otherwise, one may get an intermittent error that the response body is null
		//r.setEccParameter('skip_sensor', true);
		
		var response = r.execute();
		var responseBody = response.getBody();
		var httpStatus = response.getStatusCode();
	}
	catch(ex) {
		var message = ex.message;
	}
	
}