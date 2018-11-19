/* 
 * Application : Global
 * ClassName   : sys_script_include
 * Created On  : 2016-07-11 15:27:19
 * Created By  : kevin.anderson
 * Updated On  : 2016-07-13 01:32:57
 * Updated By  : kevin.anderson
 * URL         : - /sys_script_include.do?sys_id=a04c63690f2c2240a95eb97ce1050e11
 */
var DeleteRetrievedUpdateSets = Class.create();
DeleteRetrievedUpdateSets.prototype = {
    initialize: function() {
        // make underscore.js available for server side scripting
        gs.include('underscorejs.min'); 
        
        /**
          polyfill trim method
          @LINK https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Trim
        */   
        if (!String.prototype.trim) {
          String.prototype.trim = function () {
            return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
          };
        }
    },

    type: 'DeleteRetrievedUpdateSets',
    
    process:function (created, release_date, contains_text, not_contains_text) {
		var json = new JSON();
        var matching_records = this.getMatching(created, release_date, contains_text, not_contains_text);
        if (matching_records.length){
            this.deleteMatching(created, release_date, contains_text, not_contains_text);
            gs.log('Deleted Retreived Update Set Records: '+json.encode(matching_records), this.type);
        }
	},
    
    /**
      get glide record object ready to query for the matching search params
      @method getGlideRecord
      @param {string} created_datetime
      @param {string} release_datetime
      datetime format: YYYY-MM-DD HH:SS:MS
      @param {string} contains_text - comm delim list of words to match the update sets on (each word is an OR query)
      @param {string} not_contains_text - contains_text - comm delim list of words to NOT match on for the the update set search (each word is an OR query)

    */
    'getGlideRecord': function(created, release_date, contains_text, not_contains_text){
        if (this.isValidDateTime(created) || this.isValidDateTime(release_date)){
            var gr = new GlideRecord('sys_remote_update_set');
            
            if (JSUtil.notNil(created) && created.length){
                gr.addQuery('sys_created_on', '>=', created);   
                
            }
            if (JSUtil.notNil(release_date) && release_date.length){
                // strip the time off the release date if it is present
                gr.addQuery('release_date', release_date.substring(0,10));
            }
            
            if (JSUtil.notNil(contains_text)){
                // create a filter for name contains any of the the comma delim string of matching words
                gr = this.addGlideTextFilters(gr, contains_text, 'name', true);
            }
            if (JSUtil.notNil(not_contains_text)){
                // create a filter for name DOES NOT contain any of the the comma delim string of matching words
                gr = this.addGlideTextFilters(gr, not_contains_text, 'name', false);
            }
            gr.addQuery('state','IN','loaded,previewed,committed');
            gr.orderByDesc('sys_created_on');
            return gr;
        }
    },
    
    /**
      delete update sets in the loaded state from the retrieved update set table
      @method deleteMatching
      @param {string} created delete all records that occur ON or AFTER a created date 
      @param {string} release_date delete all records that match the release date
      @param {string} contains_text - comm delim list of words to match the update sets on (each word is an OR query)
      @param {string} not_contains_text - contains_text - comm delim list of words to NOT match on for the the update set search (each word is an OR query)

    */
    'deleteMatching' : function(created, release_date, contains_text, not_contains_text){
        var deleted = 0;
        var gr = this.getGlideRecord(created, release_date, contains_text, not_contains_text)
        if (JSUtil.notNil(gr)){           
            gr.query();
            //gs.log(gr.getEncodedQuery(),'delete retrieved');
            if (gr.next()){
                deleted = gr.getRowCount();
                gr.deleteMultiple();
            }    
        }
      
        return deleted;
    }, 
    
     /**
      get the list of  update sets in the loaded state from the retrieved update set table
      @method getMatching
      @param {string} created delete all records that occur ON or AFTER a created date 
      @param {string} release_date delete all records that match the release date
      @param {string} contains_text - comm delim list of words to match the update sets on (each word is an OR query)
      @param {string} not_contains_text - contains_text - comm delim list of words to NOT match on for the the update set search (each word is an OR query)

    */
    'getMatching' : function(created, release_date, contains_text, not_contains_text){
        var result = [], obj = {};
        var gr = this.getGlideRecord(created, release_date, contains_text, not_contains_text);
        if (JSUtil.notNil(gr)){   
            gr.query();
            while (gr.next()){
                obj = {};
                obj.name = gr.name.getDisplayValue();
                obj.state = gr.state.getDisplayValue();
                obj.sys_created_on = gr.sys_created_on.getDisplayValue();
                obj.sys_id = gr.sys_id.getDisplayValue();
                result.push(obj);
            }    
        
        }
        return result;
    }, 
    
    /**
      @method isValidDateTime
      @param {string} datetime in format YYYY-MM-DD HH24:MM:SS
      @returns {boolean}
    */
    isValidDateTime : function(datetime){
        result = false;
        var format = 'yyyy-MM-dd HH:mm:ss';
        if (JSUtil.notNil(datetime) && _.isString(datetime)){
            var gdt = GlideDateTime();
            if (datetime.trim().length > 10 ){
                gdt.setValueUTC(datetime.trim(), format);
            }
            if (gdt.isValid()){
                result = true;
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
};