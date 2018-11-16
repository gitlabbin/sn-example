/* 
 * Application : Global
 * ClassName   : sys_script_include
 * Created On  : 2016-06-10 13:06:07
 * Created By  : kevin.anderson
 * Updated On  : 2016-07-15 00:58:58
 * Updated By  : kevin.anderson
 * URL         : - /sys_script_include.do?sys_id=67a2236b0ff3d600a95eb97ce1050e15
 */
var BulkUpdateSetDeployer = Class.create();
BulkUpdateSetDeployer.prototype = {
    
    /**
      usage:
      var r = new  BulkUpdateSetDeployer({'remote':'DEV'});
      
      ** to delete all before a date first?
        var r = new  BulkUpdateSetDeployer();
        var result = r.deleteRetrievedUpdateSets('2016-06-09 01:00:35')
        gs.print('deleted: '+result)
        r.start({'remote':'DEV'})

      @method initialize
    */
    initialize: function(config_obj) {
    
        this.LOG_SOURCE_NAME = 'bulk update set deployer';
    
        /**
          polyfill trim method
          @LINK https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Trim
        */   
        if (!String.prototype.trim) {
          String.prototype.trim = function () {
            return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
          };
        }
    
        // make underscore.js available for server side scripting
        gs.include('underscorejs.min'); 
        
        
        // internal data storage
        this.config = {};
        var config = this.config;
               
        
        this.config.set = function(key, value){
            if (!config.data){
                config.data = {};
            }
            if (_.isString(key) && key.length){
               config.data[key] = value;
            }
        };
        this.config.get = function(key){
            var result = null;
            if (_.isString(key) && key.length && _.has(config.data, key)){
                result = config.data[key];
            }
            return result;
        };
        
        
        this.config.set('WORKER_WAIT_MS', 3000);
        this.config.set('MAX_WORKER_LOOP', 3600); // max wait time is 1 hours
        
        if (_.isObject(config_obj) && _.keys(config_obj).length){
            this.start(config_obj);
        }
        
    },

    /**
      @method getTransactionId
    */
    getTransactionId: function(){
        return this.config.get('transaction_id');
        
    },
    
    /**
      @method getRemoteSystemRecord
    */
    getRemoteSystemRecord: function(remote_system){
        var result = null;
        var r = new GlideRecord('sys_update_set_source');
        if (this.isValidSysId(remote_system)){
           r.addQuery('sys_id',remote_system); 
        }
        else{
           r.addQuery('name',remote_system); 
        }
        r.query();
        //gs.log('Searching Remote Instances for: '+remote_system, this.LOG_SOURCE_NAME);
        if (r.next()){
            //gs.log('remote: '+r.getDisplayValue('name')+', '+r.getDisplayValue('sys_id'), this.LOG_SOURCE_NAME);
            result = r;
        }
        this.addLogMessage('found '+r.getRowCount()+' remote system record(s)');
        return result;
    },
    
    /**
      @method retrieveRemoteUpdateSets
    */
    retrieveRemoteUpdateSets: function(remote_system_sys_id){
        var result = false;
        gs.print('fetch remote param: '+JSUtil.notNil(remote_system_sys_id)+', '+remote_system_sys_id);
        if (JSUtil.notNil(remote_system_sys_id)){
           if (remote_system_sys_id){
           
               var worker = new GlideUpdateSetWorker();
                
               worker.setUpdateSourceSysId(remote_system_sys_id);
               worker.setBackground(true);
               worker.start();
               var progress_id = worker.getProgressID();
               result = progress_id;
               this.addLogMessage('Begin fetch update sets from remote system: '+(this.getRemoteSystemRecord(remote_system_sys_id)).getDisplayValue('name'));
               this.addLogMessage('fetch remote update sets progress worker id: '+result);
           }
        }
        else{
            gs.print('the sys_id parameter is null - retrieveRemoteUpdateSets');
        }
        return result;
    },
    
    /**
      set the class property time_start
      @method setStartTime
      @param {string} date in format 'YYYY-MM-DD', or 'YYYY-MM-DD HH24:MM:SS'
      @param {string} time in format HH24:MM:SS, or null
    */
    setStartTime : function(date, time){
        if (this.isValidDateTime(date, time) ){
            if (date.length > 10){
                 this.config.set('time_start', date.trim());
            }
            else{
                this.config.set('time_start', (date+' '+(time||'00:00:01')).trim());
            }
        }
        else{
            this.config.set('time_start', gs.nowNoTZ());
        }    
        
    },
    
    /**
      used when this is called from a background script
      @method start
      todo: verify still fully functional after july 2016 updates
    */
    start : function(obj){
         var json = new JSON();
        var context = this;
        if (_.isObject(obj) && _.keys(obj).length){
            
            if (_.has(obj, 'remote')){

                this.config.set('time_start', gs.nowNoTZ()); // current time in GMT
                this.config.set('transaction_id', gs.generateGUID());
                gs.log('started: '+this.config.get('time_start')+', '+this.config.get('transaction_id'));
                var remote_gr = this.getRemoteSystemRecord(obj.remote);
                if (_.has(remote_gr, 'sys_id')){
                    gs.print('found');
                    var worker_id = this.retrieveRemoteUpdateSets(remote_gr.getDisplayValue('sys_id'));
                    gs.print('remote update set fetch - worker id:'+ worker_id);
                    
                    if (this.waitForWorkerComplete(worker_id).toLowerCase() === 'success'){
                        gs.print('finished fetching update sets');
                        // preview update sets
                        var preview_workers = this.previewUpdateSets( this.config.get('time_start'));
                        gs.print('workers: '+preview_workers.toString());
                        gs.print('worker count: '+this.getWorkerCountByTransaction(this.config.get('transaction_id')));
                        // loop through the workers, and as they complete, generate a report
                        var total_workers = preview_workers.length;
                        var completed_workers = this.getCompletedWorkerCountByTransaction(this.config.get('transaction_id'));
                        var processed_update_sets = [];
                        var counter = 0;
                        var reports = [];
                        while (processed_update_sets.length < total_workers){
                            var wait_for_workers = false;
                            completed_workers = this.getCompletedWorkerCountByTransaction(this.config.get('transaction_id'));
                            if (completed_workers > 0){
                                if (completed_workers > processed_update_sets.length){
                                    // get the first completed worker from the list
                                    var update_set_sys_id = this.getUpdateSetSysIdFromPreviewWorkerByTransaction(this.config.get('transaction_id'), processed_update_sets);
                                    if (JSUtil.notNil(update_set_sys_id)){
                                        processed_update_sets.push(update_set_sys_id);
                                        gs.log('completed: '+update_set_sys_id);
                                        // create a report for the update set
                                        reports.push(this.getUpdatesetPreviewReport(update_set_sys_id));
                                        
                                        // set the retrieved update set to previewed
                                        // for now - lets just assume this works, no error check
                                        // disabled - do this in the update set preview report call above
                                        /*
                                        var gr = new GlideRecord('sys_remote_update_set');
                                        if (gr.get(update_set_sys_id)){
                                            gr.state = 'previewed';
                                            gr.autoSysFields(false);
                                            gr.update();
                                        }
                                        */
                                        
                                       
                                        gs.print(json.encode(reports));
                                        
                                        
                                       
                                         
                                    }
                                }
                                else{
                                   wait_for_workers = true;
                                }
                            }
                            else{
                                wait_for_workers = true;
                            }
                                
                            if (wait_for_workers) {
                               gs.print('**waiting for preview workers to complete: '+gs.nowDateTime()); 
                               this.waitSec(this.config.get('WORKER_WAIT_MS')); 
                               
                            }
                            
                            if (counter < this.config.get('MAX_WORKER_LOOP')){
                                counter ++;
                            }
                            else{
                                gs.log('Error: maximum loop count exceeded while waiting for completed update set preview workers','start::'+this.type);
                                break;
                            }
                            
                        }
                        
                        
                        if (reports.length){
                            
                            
                            
                            // update set tally
                            gs.log('total Update Sets '+reports.length);          
                                        
                            // how many have error:
                            gs.log('update sets with errors: ');            
                                        
                            // how many are clean   
                            gs.log('clean update sets: ');
                            
                            var clean_update_sets = [];
                             // 1. loop through data structure, 
                            // 2  for each update set, find those where collision array is empty
                            _.each(reports, function(v, k){
                                gs.print(json.encode(v))
                                if (_.has(v, 'collisions') && _.has(v, 'clean_updates')){

                                    if (_.isArray(v.collisions) && v.collisions.length === 0 && _.isNumber(v.clean_updates) && v.clean_updates > 0){
                                        gs.print('here: '+k)
                                        clean_update_sets.push(v.update_set_sys_id)
                                    }
                                } 
                            });
                            
                            if (clean_update_sets.length){
                                var workers = [];
                                // commit these
                                _.each(clean_update_sets, function(v, k){
                                    workers.push(this.commitRemoteUpdateSet(v));
                                }, this);
                                gs.print(workers.toString());
                            }
                            
                        }

                    }
                    else{
                        gs.log('Error: for progress worker "'+worker_id+'", a complete state was not detected', 'start::'+this.type);
                    }
                }
                else{
                    gs.print('Error: no remote system found matching name: '+obj.remote);
                }
                
            }
           
        }
    },
    
    /**
      set the state on the update set to 'previewed'
      @method setRemoteUpdateSetPreviewed
      @param {string} update_set_sys_id
    */
    setRemoteUpdateSetPreviewed : function(update_set_sys_id){
        if (this.isValidSysId(update_set_sys_id)){
            var gr = new GlideRecord('sys_remote_update_set');
            if (gr.get(update_set_sys_id)){
                gr.state = 'previewed';
                gr.autoSysFields(false);
                gr.update();
            }
        }
    },
    

    /**
      read the contents of the update set preview
      @method getUpdatesetPreviewReport
      @param {string} remote_update_set_sys_id
    */
    getUpdatesetPreviewReport : function(remote_update_set_sys_id){
        var report = {};
        var gr;
        if (JSUtil.notNil(remote_update_set_sys_id)){
            var cntr = 0;
            gr = new GlideRecord('sys_update_preview_xml');
            gr.addQuery('sys_created_on', '>=', this.config.get('time_start'));
            gr.addQuery('remote_update.remote_update_set', remote_update_set_sys_id);
            gr.addNotNullQuery('problem_type');
            gr.query();
            while (gr.next()){
                if (cntr === 0){
                    //gs.print('---------Preview Report: '+remote_update_set_sys_id+'-------------')
                    report.update_set_name = gr.remote_update.remote_update_set.getDisplayValue('name');
                    report.update_set_sys_id = gr.remote_update.remote_update_set.sys_id+'';
                    report.dirty_updates = 0;
                    report.clean_updates = 0;
                    report.collisions = [];
                }
                // issue - duplicates may exists if run more than once a day
                // proposal:  generte timestamp before preview worker begin
                // find all matching preview reports newer than timestamp
                
                // disposition has the anaysis info: https://dev13778.service-now.com/nav_to.do?uri=sys_update_preview_xml.do?sys_id=6a3b40a70f33d600a95eb97ce1050ef5
                // build in script report
                var collision = {};
                collision.disposition = gr.getDisplayValue('disposition');
                collision.problem_type = gr.getDisplayValue('problem_type');
                collision.description = this.getPreviewProblemDescription(gr.remote_update.remote_update_set, gr.remote_update);
                collision.target_sys_id = gr.remote_update+'';
                collision.target_name = gr.remote_update.getDisplayValue('target_name');
                collision.sys_id = gr.sys_id+'';
                report.collisions.push(collision);
                /*
                gs.print('Disposition: '+gr.getDisplayValue('disposition'))
                gs.print('problem type: '+gr.getDisplayValue('problem_type'))
                gs.print('description: '+this.getPreviewProblemDescription(gr.remote_update.remote_update_set, gr.remote_update))
                gs.print('target name: '+gr.remote_update.getDisplayValue('target_name'))
                gs.print('update set: '+gr.remote_update.remote_update_set.getDisplayValue('name'))
                gs.print('********')
                */
                /*
                disposition
                remote_update.type
                remote_update.target_name
                remote_update.remote_update_set.name
                problem_type
                */
                cntr ++;

            }
            if (_.keys(report).length > 0){
                report.dirty_updates = cntr;
            }    
            
            // get total clean dispositions from the update set
            gr = new GlideRecord('sys_update_preview_xml');
            gr.addQuery('sys_created_on', '>=', this.config.get('time_start'));
            gr.addQuery('remote_update.remote_update_set', remote_update_set_sys_id);
            gr.addNullQuery('problem_type');
            gr.query();
            if (gr.next()){
                if (_.keys(report).length === 0){
                    report.update_set_name = gr.remote_update.remote_update_set.getDisplayValue('name');
                    report.update_set_sys_id = gr.remote_update.remote_update_set.sys_id+'';
                    report.collisions = [];
                    report.dirty_updates = 0;
                }
                report.clean_updates = gr.getRowCount();
            }

            
            
            //if (gr.getRowCount() > 0){
                //gs.print('---------end report-------------')
            //}    
        }
        return report;
        
    },
    
    /**
    
      @method getPreviewProblemDescription
    */
    getPreviewProblemDescription : function(update_set_sys_id, target_name_sys_id){
        var description = '';
        if (JSUtil.notNil(update_set_sys_id) && JSUtil.notNil(target_name_sys_id)){
            var gr = new GlideRecord('sys_update_preview_problem');
            gr.addQuery('sys_created_on', '>=', this.config.get('time_start'));
            gr.addQuery('remote_update_set', update_set_sys_id);
            gr.addQuery('remote_update', target_name_sys_id);
            gr.query();
            if (gr.next()){
                description = gr.getDisplayValue('description');
            }
        }
        return description;
    },
    
    
    /**
      get the sysid for the retrieved update set
      from the  preview worker message
      @method getUpdateSetSysIdFromPreviewWorkerMessage
      @param {string} worker_id
      @returns {string} remote update set sys_id
      
    */
    getUpdateSetSysIdFromPreviewWorkerMessage : function(worker_id){
        var remote_update_set_sys_id = '';
        if (!_.isArray(exclude_list)){
            exclude_list = [];
        }
        if (JSUtil.notNil(transaction_id) ){
            var gr = new GlideRecord('sys_progress_worker');
            
            if (gr.get(worker_id)){
                var pos = gr.getDisplayValue('message').toLowerCase().indexOf('update set:');
                if(pos > 0){
                    remote_update_set_sys_id = gr.getDisplayValue('message').substring((pos+11)).trim();
                }
            }
        }
        return remote_update_set_sys_id ;
        
    },
    
    
    /**
      get the sysid for the first matching retrieved update set
      where the preview worker is completed
      @method getUpdateSetSysIdFromPreviewWorkerByTransaction
      @param {string} transaction_id
      @param {array} exclude_list  list of sysids to ignore
      @returns {string} remote update set sys_id
      
    */
    getUpdateSetSysIdFromPreviewWorkerByTransaction : function(transaction_id, exclude_list){
        var remote_update_set_sys_id = '';
        if (!_.isArray(exclude_list)){
            exclude_list = [];
        }
        if (JSUtil.notNil(transaction_id) ){
            var gr = new GlideRecord('sys_progress_worker');
            gr.addQuery('sys_created_on', '>=', this.config.get('time_start'));
            gr.addQuery('message', 'CONTAINS', transaction_id);
            gr.addNotNullQuery('state_code');
            gr.orderBy('sys_created_on');
            gr.query();
            while (gr.next()){
                //gs.print('****searching workers for completed update set: '+gr.message)
                var pos = gr.getDisplayValue('message').toLowerCase().indexOf('update set:');
                if(pos > 0){
                    var parsed_id = gr.getDisplayValue('message').substring((pos+11)).trim();
                    if (parsed_id.length && _.indexOf(exclude_list, parsed_id) < 0 ){
                        remote_update_set_sys_id = parsed_id;
                    }
                }
                
            }
        }
        return remote_update_set_sys_id ;
        
    },


    /**
      observe the progress workers where the message contains the matching transaction id
      @method getCompletedWorkerByTransaction
    */
    getCompletedWorkerCountByTransaction : function(transaction_id){
        var count = 0;
        if (JSUtil.notNil(transaction_id)){
            var gr = new GlideRecord('sys_progress_worker');
            gr.addQuery('sys_created_on', '>=', this.config.get('time_start'));
            gr.addQuery('message', 'CONTAINS', transaction_id);
            gr.addNotNullQuery('state_code');
            //gs.print(gr.getEncodedQuery())
            gr.query();
            if (gr.next()){
                count = gr.getRowCount();
                
            }
            gs.print(count)
        }
        return count;
        
    },
    
    
    /**
      gets the number of workers where the message contains the tranaction ID
      limits results to those where the created date is greater or equal to  config.time_start
      @method getWorkerCountByTransaction
      @returns {number}
    */
    getWorkerCountByTransaction : function(transaction_id){
        var count = 0;
        if (JSUtil.notNil(transaction_id)){
            var gr = new GlideRecord('sys_progress_worker');
            gr.addQuery('sys_created_on', '>=', this.config.get('time_start'));
            gr.addQuery('message', 'CONTAINS', transaction_id);
            gr.query();
            if (gr.next()){
                count = gr.getRowCount();
                
            }
        }
        return count;
    },
    
    /**
      process all retrieved updatesets where created after a date and / or matching a release date
      returns the list of progress worker IDs associated with the matching update sets
      @method previewUpdateSets
      @param {string} created_datetime
      @param {string} release_datetime
      datetime format: YYYY-MM-DD HH:SS:MS
      @param {string} contains_text - comm delim list of words to match the update sets on (each word is an OR query)
      @param {string} not_contains_text - contains_text - comm delim list of words to NOT match on for the the update set search (each word is an OR query)

      @returns array
    */
    previewUpdateSets : function(created_datetime, release_datetime, contains_text, not_contains_text){
        var context = this;
        var preview_worker_ids = [];
        var update_set_sysids = this.getRetrievedUpdateSetSysIds( created_datetime, release_datetime, contains_text, not_contains_text);
        this.config.set('transaction_id', gs.generateGUID());
        _.each(update_set_sysids, function(v,k){
            var worker = context.previewUpdateSet(v);
            if (JSUtil.notNil(worker)){
                preview_worker_ids.push(worker);
            }
        });
        
        return preview_worker_ids;
    },
    
    /**
      start the preview worker for a single update set
      @method previewUpdateSet
    */
    previewUpdateSet : function(remote_update_set_sys_id){
        var worker_id = '';
        if (JSUtil.notNil(remote_update_set_sys_id)){
            var gr = new GlideRecord('sys_remote_update_set');
            if (gr.get(remote_update_set_sys_id)){
                var worker = new GlideScriptedProgressWorker();
                worker.setProgressName('Generating Preview Report - '+gr.getDisplayValue('name'));
                worker.setName('UpdateSetPreviewer');
                worker.addParameter(remote_update_set_sys_id);
                worker.addParameter("preview");
                worker.setBackground(true);
                worker_id = worker.getProgressID();
                worker.start();
                worker.setProgressMessage('Transaction ID: '+this.config.get('transaction_id')+', Remote Update Set: '+remote_update_set_sys_id);
                
                // fire off progress worker to set the previewed flag when the worker is complete
                var worker2 = new GlideScriptedProgressWorker();
                worker2.setProgressName('Set state to "previewed" after preview process completes');
                worker2.setName('SetRemoteUpdateSetPreviewed');
                worker2.addParameter(worker_id);
                worker2.addParameter(remote_update_set_sys_id);
                worker2.setBackground(true);
                worker2.start();
                worker2.setProgressMessage('Transaction ID: '+this.config.get('transaction_id')+', Remote Update Set: '+remote_update_set_sys_id);
                
            }
        }
        return worker_id;
    },
    
    /**
      @method isValidWorkerID
      @returns {boolean}
    */
    isValidWorkerID : function(worker_sys_id){
        result = false;
        if (JSUtil.notNil(worker_sys_id)){
            var gr = new GlideRecord('sys_progress_worker');
            if (gr.get(worker_sys_id)){
                result = true;
            }
        }    
        return result;
    },
        
    
    /**
      get the status of the progress worker
      @method checkWorkerState
      @param {string} progress worker sys_id
    */
    checkWorkerState : function(worker_sys_id){
        var code = '';
        var gr = new GlideRecord('sys_progress_worker');
        gr.addNotNullQuery('state_code');
        if (gr.get(worker_sys_id)){
            code = gr.getDisplayValue('state_code');
            
        }
        else{
            gs.log('Error: invalid worker id: '+worker_sys_id,'checkWorkerState::'+this.type);
        }
        return code;
    },
    
    /**
      for a progress worker, wait until the state is complete
      @method waitForWorkerComplete
      @param {string} worker_id
    */
    waitForWorkerComplete : function(worker_id){
        var result = '';
        if (this.isValidWorkerID (worker_id)){
            var MAX_LOOP = this.config.get('MAX_WORKER_LOOP');
            var cntr = 0;
            var worker_state = '';
            // wait for worker to complete
            while (JSUtil.nil(this.checkWorkerState(worker_id))){
                worker_state = this.checkWorkerState(worker_id);
                gs.print('check state: '+worker_state);
                this.waitSec(this.config.get('WORKER_WAIT_MS'));
                if (cntr > MAX_LOOP){
                    gs.log('Error: progress worker wait check, max loop exceeded - '+MAX_LOOP,'waitForWorkerComplete::'+this.type);
                    break;
                }
                cntr++;
            }
            result = this.checkWorkerState(worker_id); 
 
        }
        return result;
    },
    
    /**
      @method waitSec
    */
    waitSec: function(time_msec){
        var mseconds = parseInt(time_msec, 10);
        if (!isNaN(mseconds) && mseconds > 0){
            gs.sleep(mseconds);
        }
    },
    
    /**
        get the list of matching retrieved update set sysids
        note this should not be called from client side - requires GMT date field
        @method getRetrievedUpdateSetSysIds
        @param {string} created_datetime
        @param {string} release_datetime
        datetime format: YYYY-MM-DD HH:SS:MS
        @param {string} contains_text - comm delim list of words to match the update sets on (each word is an OR query)
        @param {string} not_contains_text - contains_text - comm delim list of words to NOT match on for the the update set search (each word is an OR query)

    */
    getRetrievedUpdateSetSysIds : function(created_datetime, release_datetime, contains_text, not_contains_text){
        var update_set_sys_ids = [];
        if (this.isValidDateTime(created_datetime) || this.isValidDateTime(release_datetime)){
            var gr = new GlideRecord('sys_remote_update_set');
            
            if (JSUtil.notNil(created_datetime) && created_datetime.length){
                gr.addQuery('sys_created_on', '>=', created_datetime);   
            }
            if (JSUtil.notNil(release_datetime) && release_datetime.length){
                // strip the time off the release date time string
                gr.addQuery('release_date', 'ON', release_datetime.substring(0,10));
            }

            if (JSUtil.notNil(contains_text)){
                // create a filter for name contains any of the the comma delim string of matching words
                gr = this.addGlideTextFilters(gr, contains_text, 'name', true);
            }
            if (JSUtil.notNil(not_contains_text)){
                // create a filter for name DOES NOT contain any of the the comma delim string of matching words
                gr = this.addGlideTextFilters(gr, not_contains_text, 'name', false);
            }
            
            gr.addQuery('state','loaded');

            gr.orderBy('name');
            this.addLogMessage('retrieved sysids query: '+gr.getEncodedQuery())
            gr.query();
            while (gr.next()){  
                update_set_sys_ids.push(gr.sys_id+'');
                gs.print('retrieved update set: '+gr.name +', '+gr.sys_created_on+ ', '+gr.remote_sys_id+', '+gr.sys_id)

            }
        }
        return update_set_sys_ids;
    },
    
    /**
      @method isValidDateTime
      @param {string} date in format YYYY-MM-DD
      @param {string} time in format HH24:MM:SS
      @returns {boolean}
    */
    isValidDateTime : function(date, time){
        var result = false;
        var parse_failed = false;
        var format = 'yyyy-MM-dd HH:mm:ss';
        if (JSUtil.notNil(date) && _.isString(date)){
            var gdt = GlideDateTime();
            if (date.trim().length > 10 ){
                try {
                    gdt.setValueUTC(date.trim(), format);
                    //gs.print('date test:'+date.trim());
                }
                catch(e){
                    gs.log('Error: '+ e.message+' - isValidDateTime', this.type);
                    parse_failed = true;
                }
            }
            else{
                if (JSUtil.nil(time)){
                    time = '00:00:01';
                }
                gdt.setValueUTC((date+' '+time).trim(), format);
                //gs.print('date test:'+(date+' '+time).trim());
            }
            if (!parse_failed && gdt.isValid()){
                result = true;
            }
        }
        return result;
    },
    
    
    /**
      for glide queries, convert a date string to native system date string
      using gs.dateGenerate
      @method dateStringToSystemDate
    */
    dateStringToSystemDate : function(date_str){
        var result = '';
        var gdt = GlideDateTime();
        if (JSUtil.notNil(date_str)){
            var date = '', time = '';
            if (date_str.length > 10){
                gdt.setValueUTC(date_str, 'yyyy-MM-dd HH:mm:ss');
                if (gdt.isValid()){
                    date = gdt.toString().substring(0,10);
                    time = gdt.toString().substring(11);
                    result = gs.dateGenerate(date, time);
                }    
            }
            else{
                gdt.setValueUTC(date_str, 'yyyy-MM-dd');
                if (gdt.isValid()){ 
                    date = gdt.toString().substring(0,10);
                    time = '00:00:00';
                    result = gs.dateGenerate(date, time);
                }
            }
        }
        return result;
    },
    
    /**
      for a comma delimeted string of search terms
      add search terms to the glide record
      @method addGlideTextFilters
      @param {object} gr glide record
      @param {string} list
      @param {string} field_name target filed to build query conditions against
      @param {boolean} contains - defaults to true, if false - create filter for "does not contain"
    */
    addGlideTextFilters : function(gr, list, field_name, contains){
        var operator = 'DOES NOT CONTAIN';
        if (!_.isBoolean(contains)){
            contains = true;
        }
        if (contains){
            operator = 'CONTAINS';
        }

        if(_.isFunction(gr.query) && _.isString(list) && _.isString(field_name)){
            if ( field_name.length && list.length){
                var listArr = list.split(',');
                var qc;
                var cntr = 0;
                _.each(listArr, function(v,k){
                    if (v.trim().length){
                        if (cntr === 0){
                            qc = gr.addQuery(field_name, operator, v.trim());
                        }
                        else{
                            qc.addOrCondition(field_name, operator, v.trim());
                        }
                        cntr++;
                    }
                });
            }
        }
        return gr;
    },
    
    /**
        get the list of matching retrieved update set sysids
        @method getRetrievedUpdateSetSysIds
        @param {string} created_datetime
        @param {string} release_datetime
        datetime format: YYYY-MM-DD HH:SS:MS
        @param {string} contains_text - comm delim list of words to match the update sets on (each word is an OR query)
        @param {string} not_contains_text - contains_text - comm delim list of words to NOT match on for the the update set search (each word is an OR query)
    */
    getRetrievedUpdateSets : function(created_datetime, release_datetime, contains_text, not_contains_text){
        var update_sets = [];
        if (this.isValidDateTime(created_datetime) || this.isValidDateTime(release_datetime)){
        
            var gr = new GlideRecord('sys_remote_update_set');
            
            if (JSUtil.notNil(created_datetime) && created_datetime.length){
                //gr.addQuery('sys_created_on', '>=', this.dateStringToSystemDate(created_datetime));
                gr.addQuery('sys_created_on', '>=', created_datetime);                  
            }
            if (JSUtil.notNil(release_datetime) && release_datetime.length){
                // ensure the date time field does not include the time for release field
                gr.addQuery('release_date', 'ON', release_datetime.substring(0,10)); 
            }

            if (JSUtil.notNil(contains_text)){
                // create a filter for name contains any of the the comma delim string of matching words
                gr = this.addGlideTextFilters(gr, contains_text, 'name', true);
            }
            if (JSUtil.notNil(not_contains_text)){
                // create a filter for name DOES NOT contain any of the the comma delim string of matching words
                gr = this.addGlideTextFilters(gr, not_contains_text, 'name', false);
            }
            
            gr.addQuery('state','loaded');

            gr.orderBy('name');
            this.addLogMessage('retrieved query: '+gr.getEncodedQuery())
            gr.query();
            while (gr.next()){  
                var record = {
                    'name': gr.getDisplayValue('name'),
                    'description': gr.getDisplayValue('description'),
                    'loaded': gr.getDisplayValue('sys_created_on'),
                    'remote_sys_id': gr.origin_sys_id+'',
                    'origin_sys_id' : gr.remote_sys_id+'',
                    'sys_id' : gr.sys_id+'',
                };
                
                update_sets.push(record);
            }
        }
        return update_sets;
    },
    
    
    /**
      delete update sets in the loaded state from the retrieved update set table
      @method deleteRetrievedUpdateSets
      @param {string} created_datetime delete all records that occur ON or AFTER a created date 
      @param {string} release_datetime delete all records that match the release date
    */
    deleteRetrievedUpdateSets : function(created_datetime, release_datetime){
        var dru = new DeleteRetrievedUpdateSets(); 
        // uses a progress worker
        var to_delete =  dru.getMatching(created_datetime, release_datetime); 
        if (result.targets.length){
            dru.deleteMatching(created_datetime, release_datetime); 
        }
        else{
            to_delete = 0;
        }
        return to_delete;
    },    
    
    /**
      valid sys_id is alpha numeric only and 32 chars
      @method isValidSysId
      @param {string} str
      @returns {boolean}
    */
    isValidSysId : function(str){
        var result = false;
        var regex = /^[a-zA-Z0-9]+$/;
        if (_.isString(str) && str.length === 32 && regex.test(str)){
            result = true;
        }
        return result;
    },
    
    /**
            testing this fx
            var gdt = GlideDateTime();
            gs.print(gdt.getDisplayValueInternal())
            gdt.subtract(10000)
            gs.print(gdt.getDisplayValueInternal())

            var usd = new BulkUpdateSetDeployer();
            usd.addLogMessage('test');
            var json = new JSON();
            gs.print(json.encode(usd.getLogOutput(gdt.getDisplayValueInternal())))
            
      read the sys log for any log messages matching the class source attribute
      @method getLogOutput
      @param {string} created_after_date
      @returns {array}
    */
    getLogOutput : function(created_after_date){
        var messages = [];
        /*
        var gdt = GlideDateTime();
        if (JSUtil.notNil(created_after_date)){
            gdt.setValueUTC(created_after_date, 'yyyy-MM-dd HH:mm:ss');
            if (!gdt.isValid()){
                gdt = GlideDateTime();
            }
        }
        var date = gdt.toString().substring(0,10);
        var time = gdt.toString().substring(11);
        */
        var gr = new GlideRecord('syslog');
        gr.addQuery('source', 'STARTSWITH', this.LOG_SOURCE_NAME);
        //gr.addQuery('sys_created_on','>=', gs.dateGenerate(date, time));
        gr.addQuery('sys_created_on','>=', this.dateStringToSystemDate(created_after_date));
        gr.orderByDesc('sys_created_on');
        gr.query();
        while(gr.next()){
           messages.push(
            {
               'created' : gr.getDisplayValue('sys_created_on'),
               'message' : gr.getDisplayValue('message'),
            });
        }
        this.addLogMessage('query for log messages: '+gr.getEncodedQuery());
        
        return messages;
    },
    
    /**
      @method addSysLogMessage
      @param {string} msg
    */
    addLogMessage : function(msg){
        if (JSUtil.notNil(msg)){
            gs.log(msg, this.LOG_SOURCE_NAME);
        }
    },
    
    // stolen from script include: UpdateSetCommitAjax
    commitRemoteUpdateSet: function(remote_updateset_sys_id) {
		var result = {};
        //Load the remote update set and create a local updateset from it.
		var gr = new GlideRecord('sys_remote_update_set');
		gr.addQuery('sys_id', remote_updateset_sys_id);
		gr.addQuery('state', 'previewed');
        gr.query();
		gs.print(gr.getEncodedQuery());
        if ( gr.next() ) {
			gs.print('here')
            var worker = this._getGlideUpdateSetWorker();
			// inserts the new local update set and updates the remote update set accordingly
			var lus = new GlideRecord('sys_update_set');
			if (!lus.canWrite() )
				return 0;
			
			var lus_sysid = worker.remoteUpdateSetCommit(lus, gr, gr.update_source.url);
			this._copyUpdateXML(lus_sysid, gr.sys_id);
			gr.update();
			
			worker.setUpdateSetSysId(lus_sysid);
			worker.setProgressName("Commit update set: "+gr.name);
			worker.setBackground(true)
			worker.start();
			worker.setProgressMessage('Transaction ID: '+this.config.get('transaction_id')+', Remote Update Set: '+remote_updateset_sys_id);
                       
            gs.log('processing commit for '+gr.name.getDisplayValue()+" - "+remote_updateset_sys_id, this.type);
            result.worker_id = worker.getProgressID();
            result.local_sys_id =  lus_sysid;
            result.transaction_id = this.config.get('transaction_id');
            result.remote_sys_id = remote_updateset_sys_id;
            result.update_set_name = gr.name.getDisplayValue();
            
            gs.print('here2')
           
            // fire off progress worker to set the state field to ignore on matching local update sets with same name
            var worker2 = new GlideScriptedProgressWorker();
            worker2.setProgressName('Set local state "ignore" - '+result.update_set_name);
            worker2.setName('SetLocalUpdateSetsIgnored');
            worker2.addParameter(result.worker_id);
            worker2.addParameter(result.update_set_name);
            worker2.addParameter(result.local_sys_id);
            worker2.setBackground(true);
            worker2.start();
            worker2.setProgressMessage('Transaction ID: '+this.config.get('transaction_id')+', Local Update Set: '+lus_sysid);
          
            
		}
		return result;
	},
    
    // stolen from script include: UpdateSetCommitAjax
    _getGlideUpdateSetWorker: function() {
		return new GlideUpdateSetWorker();
	},
    
    // stolen from script include: UpdateSetCommitAjax
    _copyUpdateXML: function(lsysid, rsysid) {
		var xgr = new GlideRecord("sys_update_xml");
		xgr.addQuery("remote_update_set", rsysid);
		if (updateSetPreviewInstalled()) {
			var pgr = new GlideRecord("sys_update_preview_xml");
			pgr.addQuery("remote_update.remote_update_set",rsysid);
			pgr.query();
			while (pgr.next()) {
				if (pgr.proposed_action != "skip")
					continue;
				var temp = new GlideRecord("sys_update_xml")
				temp.query("sys_id", pgr.remote_update);
				if (temp.next())
					xgr.addQuery("name","!=", temp.name +"");
			}
		}
		xgr.query();
		while(xgr.next()) {
			var lxgr = new GlideRecord("sys_update_xml");
			lxgr.initialize();
			lxgr.name = xgr.name;
			lxgr.payload = xgr.payload;
			lxgr.action = xgr.action;
			lxgr.type = xgr.type;
			lxgr.target_name = xgr.target_name;
			lxgr.view = xgr.view;
			lxgr.update_domain = xgr.update_domain;
			lxgr.table = xgr.table;
			lxgr.category = xgr.category;
	    	lxgr.application = xgr.application;
			lxgr.update_set = lsysid;
			if (lxgr.isValidField('replace_on_upgrade'))
				lxgr.replace_on_upgrade = xgr.replace_on_upgrade;
			lxgr.insert();
		}
	},
    
    type: 'BulkUpdateSetDeployer',
};