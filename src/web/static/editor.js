/*
Script for the editor.
 */
import Spectre from './lib/spectre.js/src/spectre.js';

var tab_control = null;
var data_editor = null;
var shape_editor = null;
var _config = {
  service_url: '/verify',
  report_format:'json-ld',
  shape_graph_url:'https://raw.githubusercontent.com/datadavev/science-on-schema.org/feature_59_SHACL/validation/shapegraphs/soso_common_v1.1.0.ttl',
  shape_graph:''
};
var _update_timeout = null;

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

async function validateJsonLD(jsonld_txt) {
  // create form data for sending MIME/multipart
  let formdata = new FormData();
  formdata.append("fmt",getReportFormat());
  formdata.append("infer", false);
  // set the datagraph
  console.log("DATA: " + jsonld_txt);
  let dg = new Blob([jsonld_txt], {type:"application/ld+json"});
  console.log("data blob created");
  formdata.append("dg", dg);
  // set the shapegraph
  let sg = new Blob([_config.shape_graph], {type:'text/turtle'});
  console.log("shape blob created");
  formdata.append("sg", sg);
  // http request for posting to validatio nservice
  let request = new XMLHttpRequest();
  request.onreadystatechange = async function() {
    document.getElementById("v_status").innerText = this.readyState.toString();
    if (this.readyState === 4 && this.status === 200) {
      console.log(this.responseText);
      document.getElementById("v_status").innerText = this.status.toString();
      document.getElementById("validation_result").innerText = this.responseText;
    }
  };
  request.open("POST", _config.service_url, true);
  request.send(formdata)
}


async function doValidation() {
  let ele = document.getElementById("validation_result");
  ele.innerText = "Working...";
  var jsonld_text = data_editor.getDoc().getValue();
  // Only try to validate if the content is valid JSON, otherwise
  // spew an error
  try {
    let json_obj = JSON.parse(jsonld_text)
    _config.shape_graph = shape_editor.getDoc().getValue();
    console.log("JSONLD=" + jsonld_text)
    await validateJsonLD(jsonld_text)
  } catch(err) {
    ele.innerText = err.toString();
    console.log(err);
  }
}


async function onEditorChange() {
  try {
    clearTimeout(_update_timeout);
  } catch(err) {
    console.log('No timeout to clear')
  }
  _update_timeout = setTimeout(doValidation, 1000);
}

function updateEditorTurtle() {
  shape_editor.getDoc().setValue(_config.shape_graph);
  console.log("Set shacl source to editor", _config.shape_graph);
}


async function loadShaclSource() {
  let request = new XMLHttpRequest();
  request.addEventListener('load', function () {
    _config.shape_graph = this.responseText;
    console.log('SHACL loaded')
    updateEditorTurtle();
  });
  request.open('GET', _config.shape_graph_url, true);
  await request.send();
}

CodeMirror.commands.foldSub = function(cm) {
    cm.operation(function() {
      for (var i = cm.firstLine()+1, e = cm.lastLine(); i <= e; i++)
        cm.foldCode(CodeMirror.Pos(i, 0), null, "fold");
    });
  };

window.onload = async function() {
  tab_control = new Spectre.Tabs(document.getElementById('editor_tabs'));
  setReportFormat(_config.report_format);
  console.log("Initializing codemirror");
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
  loadShaclSource();
  document.getElementById('bt_validate').disabled = false;
  let bt_validate = document.getElementById('bt_validate');
  bt_validate.onclick = doValidation;
  data_editor.on('change', onEditorChange);
};

