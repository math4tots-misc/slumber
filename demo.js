/* jshint esversion: 6 */
var editor = null;
var outEditor = null;

slumber.setConsoleLog(x => {
  outEditor.replaceRange(x + '\n', CodeMirror.Pos(outEditor.lastLine()));
});

function clearOutEditor() {
  outEditor.setValue("");
  outEditor.clearHistory();
}

function onClickRun() {
  clearOutEditor();
  let dat = editor.getValue();
  let src = new slumber.Source('<main>', dat);
  slumber.runAndCatch(() => slumber.runModule(src));
}

function onClickClear() {
  clearOutEditor();
}

window.onload = function() {
  editor = CodeMirror.fromTextArea(document.getElementById('code'), {
    lineNumbers: true,
    mode: "python",
    keyMap: "sublime",
    autoCloseBrackets: true,
    matchBrackets: true,
    showCursorWhenSelecting: true,
    theme: "monokai",
    tabSize: 2,
    viewportMargin: Infinity,
  });
  outEditor = CodeMirror.fromTextArea(document.getElementById('out-editor'), {
    lineNumbers: true,
    // mode: "python",
    keyMap: "sublime",
    autoCloseBrackets: true,
    matchBrackets: true,
    showCursorWhenSelecting: true,
    theme: "monokai",
    tabSize: 2,
    readOnly: true,
    viewportMargin: Infinity,
  });
  editor.setOption("extraKeys", {
    Tab: function(cm) {
      var spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
      cm.replaceSelection(spaces);
    }
  });
};

