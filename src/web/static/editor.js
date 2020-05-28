/*
Script for the editor.
 */
import Spectre from './lib/spectre.js/src/spectre.js';

var tab_control = null;
var report_control = null;
var data_editor = null;
var shape_editor = null;
var _update_timeout = null;
var _config = null;

function getReportFormat(){
  let ele = document.getElementById('report_format');
  return ele.options[ele.selectedIndex].value;
}

function setReportFormat(report_format) {
  let ele = document.getElementById('report_format');
  for (var i=0; i < ele.options.length; i++) {
    if (ele.options[i].value === report_format) {
      ele.options[i].selected = true;
      return;
    }
  }
}

function xhrError(e) {
  console.error( `HTTP Request ${e.target._name} ${e.type}: ${e.loaded} bytes transferred`);
}

function xhrInfo(e) {
  console.debug( `HTTP Request ${e.target._name} ${e.type}: ${e.loaded} bytes transferred`);
}

function getRequest(name) {
  let request = new XMLHttpRequest();
  request._name = name;
  request.addEventListener('error', xhrError);
  request.addEventListener('abort', xhrError);
  request.addEventListener('progress', xhrInfo);
  request.addEventListener('loadstart', xhrInfo);
  request.addEventListener('load', xhrInfo);
  request.addEventListener('loadend', xhrInfo);
  return request;
}

// Actually post the JSON and SHACL for validation.
async function validateJsonLD(jsonld_txt) {
  // create form data for sending MIME/multipart
  let formdata = new FormData();
  formdata.append("fmt",getReportFormat());
  formdata.append("infer", false);
  // set the datagraph
  //console.log("DATA: " + jsonld_txt);
  let dg = new Blob([jsonld_txt], {type:"application/ld+json"});
  console.debug("data blob created");
  formdata.append("dg", dg);
  // set the shapegraph
  let sg = new Blob([_config.shape_graph], {type:'text/turtle'});
  console.debug("shape blob created");
  formdata.append("sg", sg);
  // http request for posting to validation service
  let request = getRequest("/verify");
  request.onreadystatechange = async function() {
    console.debug("Request state: " + this.readyState.toString());
    if (this.readyState === 4 && this.status === 200) {
      console.debug("Service HTTP status: ", this.status);
      console.debug("Validation report received.");
      document.getElementById("validation_result").innerText = this.responseText;
    }
  };
  console.debug("Service URL = ", _config.service_url);
  request.open("POST", _config.service_url, true);
  request.send(formdata)
}


async function doValidation() {
  let ele = document.getElementById("validation_result");
  console.info("Starting validation...");
  ele.innerText = "Working...";
  var jsonld_text = data_editor.getDoc().getValue();
  // Only try to validate if the content is valid JSON, otherwise
  // spew an error
  try {
    let json_obj = JSON.parse(jsonld_text)
    _config.shape_graph = shape_editor.getDoc().getValue();
    await validateJsonLD(jsonld_text);
  } catch(err) {
    ele.innerText = err.toString();
    console.error(err);
  }
}


async function onEditorChange() {
  try {
    clearTimeout(_update_timeout);
  } catch(err) {
    console.debug('No timeout to clear')
  }
  _update_timeout = setTimeout(doValidation, 1000);
}

// Load the SHACL and example JSON sources and populate the editor
async function loadShapeGraph(url) {
  let request = getRequest('Get SHACL');
  request.addEventListener('load', function () {
    _config.shape_graph = this.responseText;
    console.info('SHACL loaded');
    shape_editor.getDoc().setValue(_config.shape_graph);
  });
  request.open('GET', url, true);
  return request.send();
}

async function loadTestSources() {
  // Called at the start of an editor session
  let c_data = data_editor.getDoc().getValue();
  const p1 = loadShapeGraph(_config.shape_graph_url);
  let p2 = function(){};
  if (c_data.length < 2) {
    p2 = loadDataGraph(_config.initial_data_graph_url);
  }
  Promise.allSettled([p1, p2]).then(function() {
    console.info("Test sources loaded.")
  })
}

async function loadDataGraph(url) {
  let request = getRequest('Get Data');
  request.addEventListener('load', function () {
    _config.initial_data_graph = this.responseText;
    console.info('Example JSON loaded');
    data_editor.getDoc().setValue(_config.initial_data_graph);
  });
  request.open('GET', url, true);
  return request.send();
}

function loadShapeFromForm() {
  let inp = document.getElementById('inp_shape_source');
  let url = inp.value;
  console.info("Loading shape graph from: ", url);
  loadShapeGraph(url).then(function() {
    console.log("Loaded.");
  })
}

function loadDataFromForm() {
  let inp = document.getElementById('inp_data_source');
  let url = inp.value;
  console.info("Loading data graph from: ", url);
  loadDataGraph(url).then(function() {
    console.log("Loaded.");
  })
}

// Override the codemirror code folding to start one level down, for the JSON-LD
CodeMirror.commands.foldSub = function(cm) {
    cm.operation(function() {
      for (var i = cm.firstLine()+1, e = cm.lastLine(); i <= e; i++)
        cm.foldCode(CodeMirror.Pos(i, 0), null, "fold");
    });
  };


function clearLog() {
  document.getElementById("log").innerHTML = "";
}

//** Logger
// https://stackoverflow.com/questions/20256760/javascript-console-log-to-html
function rewireLoggingToElement(eleLocator, eleOverflowLocator, autoScroll) {
    fixLoggingFunc('log');
    fixLoggingFunc('debug');
    fixLoggingFunc('warn');
    fixLoggingFunc('error');
    fixLoggingFunc('info');

    function fixLoggingFunc(name) {
        console['old' + name] = console[name];
        console[name] = function(...args) {
            const output = produceOutput(name, args);
            const eleLog = eleLocator();

            if (autoScroll) {
                const eleContainerLog = eleOverflowLocator();
                const isScrolledToBottom = eleContainerLog.scrollHeight - eleContainerLog.clientHeight <= eleContainerLog.scrollTop + 1;
                eleLog.innerHTML += output + "<br>";
                if (isScrolledToBottom) {
                    eleContainerLog.scrollTop = eleContainerLog.scrollHeight - eleContainerLog.clientHeight;
                }
            } else {
                eleLog.innerHTML += output + "<br>";
            }

            console['old' + name].apply(undefined, args);
        };
    }

    function produceOutput(name, args) {
        return args.reduce((output, arg) => {
            return output +
                "<span class=\"log-" + (typeof arg) + " log-" + name + "\">" +
                    (typeof arg === "object" && (JSON || {}).stringify ? JSON.stringify(arg) : arg) +
                "</span>&nbsp;";
        }, '');
    }
}
//

window.onload = async function() {
  _config = document._config;
  // hijack console to log on page
  rewireLoggingToElement(
      () => document.getElementById("log"),
      () => document.getElementById("log-container"), true);
  document.getElementById('clear_log').onclick = clearLog;
  // Attach the tabs
  tab_control = new Spectre.Tabs(document.getElementById('editor_tabs'));
  report_control = new Spectre.Tabs(document.getElementById('report_tabs'));

  // Set the report format selection
  setReportFormat(_config.report_format);
  console.info("Initializing codemirror");
  data_editor = CodeMirror.fromTextArea(
    document.getElementById('jsonld_text'),
    {
      matchBrackets: true,
      autoCloseBrackets: true,
      mode: 'application/ld+json',
      lineNumbers: true,
      //lineWrapping: true,
      theme:'idea',
      gutters:["CodeMirror-linenumbers", "CodeMirror-foldgutter", "CodeMirror-lint-markers"],
      foldGutter: true,
      lint:true,
      autoRefresh: true,
      extraKeys:{
        "Ctrl-Y": cm => CodeMirror.commands.foldSub(cm),
        "Ctrl-I": cm => CodeMirror.commands.unfoldAll(cm),
      }
    });
  let shacl_ele = document.getElementById('shape_text');
  shape_editor = CodeMirror.fromTextArea(
    shacl_ele,
    {
      mode: 'text/turtle',
      lineNumbers: true,
      //lineWrapping: true,
      foldGutter: true,
      lint:true,
      autoRefresh: true,
      extraKeys:{
        "Ctrl-Y": cm => CodeMirror.commands.foldSub(cm),
        "Ctrl-I": cm => CodeMirror.commands.unfoldAll(cm),
      },
      gutters:["CodeMirror-linenumbers", "CodeMirror-foldgutter", "CodeMirror-lint-markers"],
    });
  // load example json and shacl
  loadTestSources();
  // attach UI events
  document.getElementById('bt_validate').disabled = false;
  document.getElementById('bt_validate').onclick = doValidation;
  data_editor.on('change', onEditorChange);
  document.getElementById('btn_load_data').onclick = loadDataFromForm;
  document.getElementById('btn_load_shape').onclick = loadShapeFromForm;
};

