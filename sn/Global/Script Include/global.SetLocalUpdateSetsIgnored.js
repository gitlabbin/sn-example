/* 
 * Application : Global
 * ClassName   : sys_script_include
 * Created On  : 2016-07-13 20:46:46
 * Created By  : kevin.anderson
 * Updated On  : 2016-07-14 13:29:34
 * Updated By  : kevin.anderson
 * URL         : - /sys_script_include.do?sys_id=92d8cf960f286240a95eb97ce1050eb4
 */
var SetLocalUpdateSetsIgnored = Class.create();
SetLocalUpdateSetsIgnored.prototype = {
    
    initialize: function() {
       
        
       
    },
    /**
      used by BulkUpdateSetDeployer to set the state flag on localupdate sets to ignore after commit process workers complete
      @method process
    */
    process:function (worker_id, remote_update_set_name, local_updateset_sysid) {
		var usd = new BulkUpdateSetDeployer();
        
        if (usd.isValidWorkerID(worker_id) && usd.isValidSysId(local_updateset_sysid) && JSUtil.notNil(remote_update_set_name)){
            if (usd.waitForWorkerComplete(worker_id).toLowerCase() === 'success'){
                var gr = new GlideRecord('sys_update_set');
                gr = new GlideRecord('sys_update_set');
                gr.addQuery('name', remote_update_set_name);
                gr.addQuery('sys_id', '!=', local_updateset_sysid);
                gr.query();
                while(gr.next()){
                    gr.autoSysFields(false);
                    gr.state = 'ignore';
                    gr.update();
                }
            }    
        }
	},

    type: 'SetLocalUpdateSetsIgnored'
};