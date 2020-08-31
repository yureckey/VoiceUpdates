<template>
  <div id="app">
    <div @click.capture.once="detectClick" class="app-container p-d-flex p-jc-center p-ai-center" v-bind:style="{background:backgroundColor}">

      <Card class="p-mx-2" style="width: 27em">
          <template slot="content">
            <form style="padding:0!important;">
              <InputText type="text" v-model="testtext" placeholder="Test Phrase" style="width:12em;"/>
 
              <Button icon="pi pi-play" class="p-button-rounded p-button-success" @click="testSpeak" v-tooltip.top="'Will speak test phrase with chosen voice / rate / pitch'" style="margin-left:1em" />
              <Button icon="pi pi-undo" class="p-button-rounded p-button-info" @click="reset" v-tooltip.top="'reset choice for voice / pitch / rate and stops current speech'" style="margin-left:1em" />
              <Button icon="pi pi-pause" class="p-button-rounded p-button-info" @click="stop" v-tooltip.top="'stops current speech'" style="margin-left:1em"/>

              <div class="p-my-3">
                <div class="p-text-bold" style="display:inline-block;width:6em;" v-tooltip.top="'This list depends on OS and Browser'">Voice:</div><Dropdown v-model="selectedVoice" @change="selectedVoiceChange" :options="voices" dataKey="value" optionLabel="label" scrollHeight="150px" style="width:18em;" /><!-- placeholder="Select a Voice"  -->
              </div>

              <div class="p-my-3">
                <div class="p-text-bold" style="display:inline-block;width:6em;" v-tooltip.top="'Speech rate. Default 1. Some voices can\'t use all range.'">Rate: ({{rate/10}})</div><div style="display:inline-block; width:18em;"><Slider @change="rateChange" v-model="rate" :step="1" :min="1" :max="100" /></div>
              </div>
              
              <div class="p-my-3">
                <!-- todo: when slider have big steps on change - there is some nasty cursor flickering -->
                <div class="p-text-bold" style="display:inline-block;width:6em;" v-tooltip.top="'Speech pitch. Default 1. Some voices can\'t use all range.'">Pitch: ({{pitch/25}})</div><div style="display:inline-block; width:18em;"><Slider @change="pitchChange" v-model="pitch" :step="1" :min="1" :max="50" /></div>
              </div>
              
              <div v-once v-if="!useractivated" class="p-my-3">
                <div class="p-text-bold" style="display:inline-block;width:6em;">Attention:</div><div style="display:inline-block; width:18em;"><Button icon="pi pi-bell" class="p-button-sm p-button-warning" label="Click here (or anywhere in card)!" @click="useractivated=true" v-tooltip.top="'Some browsers require user action (click) first, otherwise TTS can\'t be activated'" style="margin-left:.5em" /></div>
              </div>

              <Message v-if="message" :key="message" severity="info" :life="5000" :sticky="false" >{{message}}</Message>
            </form>
          </template>
      </Card>
    
      <Card class="p-mx-2" style="width: 27em">
        <!-- <template slot="header">
            <div><img alt="user header" src="./assets/voiceupdatestext.png" width="234px" height="41px" style="padding-left:1rem;padding-top:1rem;"></div>
        </template> -->
        <!-- <template slot="title">
            Advanced Card
        </template>
        <template slot="subtitle">
            Card subtitle
        </template> -->
        <template slot="content">
          
          <TabView class="tabview-custom">
            <TabPanel>
                <template slot="header"><i class="pi pi-info-circle"></i><span>About</span></template>
                <div style="font-size:0.9rem;"><strong>VoiceUpdates</strong> uses Browser built-in Text-To-Speech engine, so you can listen for updates in realtime!<br>
                Currently it can react to "New Item(s) Added", "Cell Updated"<br>
                Limitations: it doesn't react to Item rename, Item Delete, Archive, Move to other group, Subitem update.</div>
            </TabPanel>
            <TabPanel>
                <template slot="header"><i class="pi pi-cog"></i><span>Config Info</span></template>
                <div v-html="settingsInfo"></div>
            </TabPanel>
          </TabView>

        </template>
        <!-- <template slot="footer">
            Card footer
        </template> -->
      </Card>

    </div>

    <Toast/>
  </div>
</template>

<script>

//TODO
//subitem bug
//when updating item column date with Hour - there are two updates fired
//when updating item - check V (it was fixed, wtf?)
//when updating item - location update fired twice (it was fixed, wtf?)
//when updating item - timeline update fired twice (it was fixed, wtf?)

const debuglog = true;

//todo: where to put this function?

function MYLOG() {
  if (!debuglog) return true;
  return Function.apply.call(console.log, console, arguments);
}

function delay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

function prepText1(choice, item, boardViewId){
  MYLOG('prepText1',choice, item, boardViewId);
  var text = "";

  if (!item || !item.board) return '';

  //not in use
  var view = item.board.views.find(x=>{return x.id==boardViewId});
  if (!view) view = {name:''};

  //1-skip source name, 2-speak board name, 3-speak group name, 4-speak board + group
  switch (choice) {
    case '2': text = 'In Board "' + item.board.name + '". '; break;
    case '3': text = 'In Group "' + item.group.title + '". '; break;
    case '4': text = 'In Board "' + item.board.name + '". Group "' + item.group.title + '". '; break;
  }
  return text;
}

function colname(columns, colid){
  var column = columns.find(x=>{return x.id==colid});
  if (!column) return "";
  return column.title;
}

export default {
    data() {
        return {
            filtered_items: [],
            filteredN_O:[],
            filteredO_N:[],
            //
            rate: 10,
            pitch: 25,
            message: null,
            testtext: "Test Phrase",
            selectedVoice: null,
            voices: [/*{label: 'default', value: 1},*/],
            VOICESOBJ:[],
            settings: {},
            settingsInfo: "Trigger Type — added and updated rows<br>Filtering — only filtered<br>Columns — all<br>Speak template — value and column name<br>Source — skip source name",
            context: {},
            synth: window.speechSynthesis,//should it be there, in data?
            useractivated: false,
            backgroundColor: null,
        }
    },

    created: function(){

      MYLOG("created! ", this);
      var that = this;

      //
      //voice variables will be global
      //const SYNTH = window.speechSynthesis;
      var VOICES = [];
      var VOICES_OPTIONS = [];

      let attempts = 0;

      function onvoiceschanged(arg1, arg2){
        MYLOG("onvoiceschanged: ", arg1, arg2);
        if (that.VOICESOBJ.length<1) {//need this check, for some reasons this event gets executed too many times without real need.
          POPULATE_VOICE_LIST();
        }
      }

      function POPULATE_VOICE_LIST() {
        attempts++;
        VOICES_OPTIONS = [];
        VOICES = that.synth.getVoices();
        MYLOG("POPULATE_VOICE_LIST: ", that.synth.getVoices);

        if (!VOICES.length || !VOICES[0].name) {
          if (attempts < 10) {
            setTimeout(() => {
              MYLOG("trying " + attempts);
              POPULATE_VOICE_LIST();
            }, 250);
          } else {
            console.log("Sorry, something wrong with synth.getVoices: ", VOICES);
            //let's try anyway
            VOICES_OPTIONS.push({ label: "...", value: 0 });
          }
        } else {
          for (var i = 0; i < VOICES.length; i++) {
            var textContent = VOICES[i].name + " (" + VOICES[i].lang + ")";
            if (VOICES[i].default) textContent += " -- DEFAULT";
            VOICES_OPTIONS.push({ label: textContent, value: i });
          }

          //that.synth.cancel(); //sometime on Chrome browser, when certain config applied (rate/pitch) synth stops working and needs to be cancelled. Not sure.

          that.voices = VOICES_OPTIONS;
          that.VOICESOBJ = VOICES;
          if (that.selectedVoice === null) that.selectedVoice = {value:0};
          //console.log(VOICES, VOICES_OPTIONS);
        }
      }
      
      POPULATE_VOICE_LIST(); //for Firefox. For Chrome it needs fire onvoiceschanged. What about other browsers?
      
      if (that.synth && that.synth.onvoiceschanged !== undefined) {
        that.synth.onvoiceschanged = onvoiceschanged;
      }
      //TTS global constants

    },
    
    mounted: function () {
      MYLOG("mounted! ", this);

      this.pitchChange = this.debounce(this.pitchChange, 700);
      this.rateChange = this.debounce(this.rateChange, 700);

      var that = this;

      this.$monday.listen("settings", (res) => {
        MYLOG("settings callback: ", res);
        that.settings = res.data;
        var str = "";
        
        /*columns: {all: false, name: true, status4: true, status_15: true, text5: true}
          filtering: "2"// 1 - all data, 2 - only filtered
          speaktemplate_cell: "2" 1-value only, 2-value and column name
          speaktemplate_source: "1" 1-skip source name, 2-speak board name, 3-speak group name, 4-speak board + group
          triggerType: "1" 1-added and updated rows, 2-only added rows, 3-only updated rows*/
          
          //todo: make conversion more streamlined
          switch (res.data.triggerType) {
            case '1': str += "Trigger Type — " + "added and updated rows"; break;
            case '2': str += "Trigger Type — " + "only added rows"; break;
            case '3': str += "Trigger Type — " + "only updated rows"; break;
          }
          str += "<br>";

          switch (res.data.filtering) {
            case '1': str += "Filtering — " + "all data"; break;
            case '2': str += "Filtering — " + "only filtered"; break;
          }
          str += "<br>";

          var cols = "Columns — " + "<strong>none!</strong>";
          if (res.data.columns && res.data.columns.all) {
            cols = "Columns — " + "all";
          } else {
            var vals = res.data.columns ? Object.values(res.data.columns) : [];
            var isAnyChecked = vals.some((elem) => elem === true);
            if (isAnyChecked) cols = "Columns — " + "some selected";
          }
          str += cols;
          str += "<br>";

          switch (res.data.speaktemplate_cell) {
            case '1': str += "Speak template — " + "value only"; break;
            case '2': str += "Speak template — " + "value and column name"; break;
          }
          str += "<br>";

          switch (res.data.speaktemplate_source) {
            case '1': str += "Source — " + "skip source name"; break;
            case '2': str += "Source — " + "speak board name"; break;
            case '3': str += "Source — " + "speak group name"; break;
            case '4': str += "Source — " + "speak board + group"; break;
          }
          //str += "<br>";

          that.settingsInfo = str;
      });

      this.$monday.listen("context", (res) => {
        MYLOG("context callback: ", res);
        that.context = res.data;
        //boardId: 648494994   boardIds: [648494994]    boardViewId: 9322101    instanceId: 9322101
        if (res.data.theme === "dark") that.backgroundColor = '#363a52'; 
        else that.backgroundColor = null;
      });
      
      this.$monday.storage.instance.getItem("tts_config_selectedVoice").then((res) => {
        MYLOG("getItem tts_config_selectedVoice: ", res);
        if (!res || !res.data) return false;

        var { value, version } = res.data;
        MYLOG("value, version: ", value, version);

        if (value === null) return false;

        //todo: check voice label too, cause same index voice could be different on different browser
        if (that.VOICESOBJ.length>parseInt(value)) that.selectedVoice = {value:parseInt(value)};
      });

      this.$monday.storage.instance.getItem("tts_config_pitch").then((res) => {
        MYLOG("getItem tts_config_pitch: ", res);
        if (!res || !res.data) return false;

        var { value, version } = res.data;
        MYLOG("value, version: ", value, version);

        if (value === null) return false;

        that.pitch = parseInt(value);
      });

      this.$monday.storage.instance.getItem("tts_config_rate").then((res) => {
        MYLOG("getItem tts_config_rate: ", res);
        if (!res || !res.data) return false;

        var { value, version } = res.data;
        MYLOG("value, version: ", value, version);

        if (value === null) return false;

        that.rate = parseInt(value);
      });

      this.$monday.listen("itemIds", function (res) {
        MYLOG("listen itemIds: ", res.data);
        MYLOG("filtered_items: ", that.filtered_items);

        if (!res.data || !res.data.length) return false;
        that.filtered_items = res.data;//res.data.map(String);//ids here returned as numbers, but when we search them we have id as string, so let's convert to string here//not in use
      });

      this.$monday.listen("events", function(res) {
        MYLOG("events callback: ", res);

        if (!res || !res.data) return false;

        that.message = null;
        var skip = false;

        //this looks ugly. Need delay to ensure that filter is updated. Otherwise, since "events" processed before "itemIds" we will have wrong filter ids
        //this could be reworked - first process 'events' and save update in local variable, then in 'itemIds' event use this variable and do actual work there.
        //But this will work only with "new_items", since "change_column_values" wouldn't generate 'events' event, so rewrite look like it wouldn't gain that much...
        delay(2000).then(function(){
          MYLOG("delayed filtered_items: ", that.filtered_items);
          //MYLOG("delayed filtered_items N_O: ", that.filteredN_O);//not in use
          //MYLOG("delayed filtered_items O_N: ", that.filteredO_N);//not in use

          var items2get = res.data.itemIds;
          if (that.settings.filtering==2) {
            items2get = res.data.itemIds.filter(x=>{return that.filtered_items.indexOf(x)>-1})
          };
          MYLOG("items2get: ", items2get);
          if (items2get.length<1) return false;

          var phraseText = "";

          if (res.type === "new_items") {

            if (that.settings.triggerType==3) return false;//1-added and updated rows, 2-only added rows, 3-only updated rows

            that.getItems(items2get).then((resItems) => {
              MYLOG("data object: ", resItems);
              
              if (!resItems || !resItems.data || !resItems.data.items || resItems.data.items.length < 1) return false;

              var items = resItems.data.items;
              
              if (items.length < 1) return false;
              
              var textStart = "New Item added! ";
              if (items.length>1) textStart = items.length + " new Items added! ";
              textStart += prepText1(that.settings.speaktemplate_source, items[0], that.context.boardViewId);

              phraseText += textStart;

              //todo: only if item.state == 'active' ?
              //all / active / archived / deleted

              items.forEach(item => {

                //'name' is not in column_values
                if (that.settings.columns.all||that.settings.columns.name) phraseText += that.settings.speaktemplate_cell==2 ? 'Name "' + item.name + '". ' : '"'+item.name+'". ';//1-value only, 2-value and column name

                //todo: by different column type?
                item.column_values.forEach(col => {
                  MYLOG('col: ', col);
                  var coltext = col.text;
                  //{id: "check2", text: "v", value: "{"checked":"true","changed_at":"2020-07-22T13:36:41.093Z"}"}
                  if (col.value && col.value.checked==true) coltext = "Checked";
                  if ((that.settings.columns.all||that.settings.columns[col.id]) && coltext) phraseText += that.settings.speaktemplate_cell==2 ? colname(item.board.columns,col.id) +' "' + coltext + '". ' : '"'+coltext+'". ';
                })
              });

              MYLOG("phraseText: ", phraseText);

              var Utterance = new SpeechSynthesisUtterance(
                phraseText.substr(0, 30000)
              );
              Utterance.voice = that.VOICESOBJ[that.selectedVoice.value];
              Utterance.pitch = that.pitch/25; //0 (lowest) and 2 (highest), with 1 being the default pitch
              Utterance.rate = that.rate/10; //between 0.1 (lowest) and 10 (highest), with 1 being the default pitch
              that.synth.speak(Utterance);
              
              that.message = phraseText.substr(0, 200);
            });

          } else if (res.type === "change_column_values") {
            
            if (that.settings.triggerType==2) return false;//1-added and updated rows, 2-only added rows, 3-only updated rows

            that.getItems(items2get).then((resItem) => {
              MYLOG("data object: ", resItem);

              if (!resItem || !resItem.data || !resItem.data.items || resItem.data.items.length < 1) return false;

              var item = resItem.data.items[0]; //todo: items loop?
              
              var updatedCol = item.board.columns.find((x) => x.id === res.data.columnId);
              MYLOG("updatedCol: ", updatedCol);
              MYLOG("columnValue: ", res.data.columnValue);

              var updatedVal = item.column_values.find((x) => x.id === res.data.columnId);

              var textStart = "Item updated! ";
              
              if (res.data.columnType == "subtasks") {
                textStart = "Subitem added! ";
                if (res.data.columnValue.removed_pulse) textStart = "Subitem removed! ";
                
                //todo: more elegant solution!
                //I noted that when subitem removed there are two almost identical events fired. So getting rid of one of them
                if (res.data.columnValue.removed_pulse && !res.data.columnValue.changed_at) skip = true;
                if (res.data.columnValue.linkedPulseIds) {
                  //same problem. when subitem added there are two events. first one have "temporary" item id, so if we detecting it we can skip whole event.
                  //[{linkedPulseId: 690239447},{linkedPulseId: 690257097},{linkedPulseId: "a642a016-b637-dbfd-23ed-9267d4f48082"}]
                  //looks brittle!
                  if (res.data.columnValue.linkedPulseIds.some(a=>(a.linkedPulseId+"").indexOf("-")>-1)) skip = true;
                }
              }

              textStart += prepText1(that.settings.speaktemplate_source, resItem.data.items[0], that.context.boardViewId);
              phraseText += textStart;

              phraseText += that.settings.speaktemplate_cell==2 ? 'Name "' + item.name + '". ' : '"'+item.name+'". ';//1-value only, 2-value and column name
              
              var updatePart = that.settings.speaktemplate_cell==2 ? '"' + updatedCol.title + '": ' : ' ';

              //todo: should I try use immediate value from res.data.columnValue as much as possible, or result of query is fine?
              //result of query could be old?
              if (typeof res.data.columnValue === "string" || typeof res.data.columnValue === "number") {
                updatePart += res.data.columnValue;
              } else if (res.data.columnValue && res.data.columnValue.textual_value) {
                updatePart += res.data.columnValue.textual_value;
              } else if (res.data.columnType == "boolean") {
                if (res.data.columnValue && res.data.columnValue.checked == true) updatePart += 'Checked';
                else updatePart += 'Unchecked';
              } else if (res.data.columnType == "date") {
                updatePart += res.data.columnValue ? res.data.columnValue.date : '';
              } else if (res.data.columnType == "long-text") {
                updatePart += res.data.columnValue ? res.data.columnValue.text : '';
              } else if (res.data.columnType == "timerange") {
                updatePart += res.data.columnValue ? (res.data.columnValue.from + ' - ' + res.data.columnValue.to) : '';
              } else if (res.data.columnType == "location") {
                updatePart += res.data.columnValue ? res.data.columnValue.address : '';
                if (res.data.columnValue && res.data.columnValue.address && !res.data.columnValue.lng) skip = true;//workaround - when user update location it calls 'events' twice with slightly different parameters
              } else if (updatedVal.text || updatedVal.text==="") {
                MYLOG("last resort!");
                updatePart += updatedVal.text;
              } else {
                updatePart += JSON.stringify(res.data.columnValue);
              }

              phraseText += updatePart;

              MYLOG("updatedVal: ", updatedVal);
              MYLOG("phraseText: ", phraseText);

              var Utterance = new SpeechSynthesisUtterance(
                phraseText.substr(0, 30000)
              );
              Utterance.voice = that.VOICESOBJ[that.selectedVoice.value];
              Utterance.pitch = that.pitch/25; //0 (lowest) and 2 (highest), with 1 being the default pitch
              Utterance.rate = that.rate/10; //between 0.1 (lowest) and 10 (highest), with 1 being the default pitch
              if (!skip) that.synth.speak(Utterance);
              
              that.message = phraseText.substr(0, 200);
            });
          }
        })

      });

    },

    watch: {
      filtered_items: {
        deep: true,
        handler(newVal, oldVal){
          //MYLOG('The list of ids changed: ', newVal, oldVal);
          
          var a = new Set(newVal);
          var b = new Set(oldVal);
          var differenceNewMinusOld = [...newVal].filter(x => !b.has(x));
          var differenceOldMinusNew = [...oldVal].filter(x => !a.has(x));

          //console.log('difference New-Old: ', differenceNewMinusOld);//array of added
          //console.log('difference Old-New: ', differenceOldMinusNew);
          this.filteredN_O = differenceNewMinusOld;
          this.filteredO_N = differenceOldMinusNew;
          //array of removed. Note - there are possibility of some weird items with none-standard id, when item is just added/duplicated
          //"4ca079a5-e673-8256-b08c-16343742d4c3", "5d5f4fb5-f0e8-f935-142d-bf730dbe43d2"
        }
      },
    },
    methods: {
        debounce(func, delay) {
          let debounceTimer;
          return function() {
            //console.log("debouncing call..");
            const context = this;
            const args = arguments;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(context, args), delay);
            //console.log("..done debouncing");
          };
        },
        detectClick(evt){
          MYLOG("detectClick", evt);
          //It's for Chrome, but eventually could be used in other browsers, so let's use this for all
          //we need user to manually click somewhere first. Otherwise:
          //[Deprecation] speechSynthesis.speak() without user activation is no longer allowed since M71, around December 2018. See https://www.chromestatus.com/feature/5687444770914304 for more details
          this.useractivated = true;
        },
        selectedVoiceChange(evt){
          MYLOG("selectedVoiceChange", evt, evt.value.value);
          //MYLOG("selectedVoice", this.selectedVoice.value);
          //this.selectedVoice = {value:0};
          this.$monday.storage.instance.setItem("tts_config_selectedVoice", evt.value.value).then((res) => {MYLOG("res", res);});
        },
        pitchChange(evt){
          MYLOG("pitchChange", evt);
          //MYLOG("selectedVoice", this.selectedVoice.value);
          this.$monday.storage.instance.setItem("tts_config_pitch", evt).then((res) => {MYLOG("res", res);});
        },
        rateChange(evt){
          MYLOG("rateChange", evt);
          //MYLOG("selectedVoice", this.selectedVoice.value);
          this.$monday.storage.instance.setItem("tts_config_rate", evt).then((res) => {MYLOG("res", res);});
        },
        getItems (itemIds) {
          //MYLOG("getItems: ", itemIds);
          return this.$monday.api(`query {
            items (ids:[${itemIds}]) {
              id
              group {title, archived, deleted, id}
              board {id, name, views {id, name, type}, board_kind, columns {id, pos, title, type}}
              column_values {id, text, value}
              name
              state
            }
          }`);
        },

        testSpeak(){
          var phraseText = this.testtext;
          MYLOG("phraseText: ", phraseText);

          var Utterance = new SpeechSynthesisUtterance(
            phraseText.substr(0, 30000)
          );
          Utterance.voice = this.VOICESOBJ[this.selectedVoice.value];
          Utterance.pitch = this.pitch/25; //0 (lowest) and 2 (highest), with 1 being the default pitch
          Utterance.rate = this.rate/10; //between 0.1 (lowest) and 10 (highest), with 1 being the default pitch
          //Utterance.text //The maximum length of the text that can be spoken in each utterance is 32,767 characters.
          //Utterance.volume //between 0 (lowest) and 1 (highest). default value 1
          this.synth.speak(Utterance);

          Utterance.onerror = function(event) {
            MYLOG('An error has occurred with the speech synthesis: ' + event.error);
          }
        },

        reset(){
          MYLOG("reset", this.selectedVoice.value);
          
          this.selectedVoice = {value:0};
          this.rate = 10;
          this.pitch = 25;
          this.testtext = "Test Phrase";
          
          this.$monday.storage.instance.setItem("tts_config_selectedVoice", 0);
          this.$monday.storage.instance.setItem("tts_config_pitch", 25);
          this.$monday.storage.instance.setItem("tts_config_rate", 10);
          
          this.synth.cancel();
        },

        stop(){
          this.synth.cancel();
        }
    },
    components: {}
}


</script>


<style>

/*todo: is it proper way to set height for primevue app? */
.app-container {
    height: 95vh;
}

.app-container .p-card-header img {
    width: unset;
}

.app-container .p-card {
    background: #f4f4f4;
}

.p-card .p-card-body .p-card-content {
    padding-top: 0.5rem;
    padding-right: 0;
    padding-bottom: 0;
    padding-left: 0;
}

.tabview-custom.p-tabview .p-tabview-panels {
    background: #f4f4f4;
}

.tabview-custom i, .tabview-custom span {
    vertical-align: middle;
}
.tabview-custom span {
    margin: 0 .5rem;
}

</style>