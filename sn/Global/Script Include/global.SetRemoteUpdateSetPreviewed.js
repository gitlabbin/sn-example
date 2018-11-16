/* 
 * Application : Global
 * ClassName   : sys_script_include
 * Created On  : 2016-07-11 19:20:58
 * Created By  : kevin.anderson
 * Updated On  : 2016-07-11 19:36:58
 * Updated By  : kevin.anderson
 * URL         : - /sys_script_include.do?sys_id=7902ac390f6c2240a95eb97ce1050e9e
 */
var SetRemoteUpdateSetPreviewed = Class.create();
SetRemoteUpdateSetPreviewed.prototype = {
    
    initialize: function() {
       
        
       
    },
    /**
      used by BulkUpdateSetDeployer to set the previewed flag on retrieved update sets after preview process workers complete
      @method process
    */
    process:function (worker_id, remote_update_sysid) {
		var usd = new BulkUpdateSetDeployer();
        if (usd.isValidWorkerID(worker_id) && usd.isValidSysId(remote_update_sysid)){
            if (usd.waitForWorkerComplete(worker_id).toLowerCase() === 'success'){
                usd.setRemoteUpdateSetPreviewed(remote_update_sysid);
                
                
            }
        }
	},

    type: 'SetRemoteUpdateSetPreviewed'
};