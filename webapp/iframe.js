/*
iframe.js, additional script for consulting

to be referred after common.js and jquery.*.js
*/

var APPLICATION_ID = 1;
var TIMEOUT = 1000;
var DATA_URL = getDataUrl(); // in common.js


/* The functions updates the current page (in iframe) to the wanted one */
function setPage(nextUrl) {
    window.location = nextUrl;
}

/* The functions updates the current page (in iframe) to the wanted one */
function setEducationPage() {
    window.location = '../naloge/startizo.html';
}


/// The function processes a click to a choice:
/// logs 'nodeId', 'givenParams';
/// and optionally loads the next document (if nextUrl is not empty) into a frame
function logAndSetPage(nodeId, givenParams, nextUrl) {
    //alert ('selectNext '+ nodeId+' '+givenParams+' '+nextUrl);
    $('#progressBar').show(); // no need to hide it later
    // as the window.location is going to change soon
    requestData =  {
            node: nodeId,
            params: givenParams,
            application: APPLICATION_ID
        };
    $.ajax({
        url: DATA_URL + 'consult/log',
        type: 'GET',
        data: requestData,
        xhrFields: { withCredentials: true },
        async: true,
        cache: false,
        timeout: TIMEOUT,
        complete: function(data, textStatus, xhr) {
            $('#progressBar').hide();
            if (nextUrl) {
                setPage(nextUrl);
            }
        },
    });
}

function selectNext(nodeId, givenParams, nextUrl) {
    logAndSetPage(nodeId, givenParams, nextUrl);
}

function logParameters(nodeId, givenParams) {
    logAndSetPage(nodeId, givenParams, '');
}

/// The function processes a click to a choice:
/// evaluates correctness (answerState == -1/0/1 signifies unanswered/incorrect/correct answer);
/// and logs 'nodeId', 'givenParams'
function selectEvaluate(nodeId, givenParams, answerState) {
    //alert ('selectEvaluate '+ nodeId+' '+givenParams+' '+nextUrl);
    var evalHtml;
    if (answerState == 1) {
        evalHtml='Vaš odgovor je <span style="background:#6f6">pravilen</span>.';
    } else if (answerState == 0) {
        evalHtml='Vaš odgovor je <span style="background:#f66">napačen</span>.';
    } else {
        evalHtml='Čakam na odgovor.';
    }
    document.getElementById("evaluation").innerHTML=evalHtml;
    document.getElementById("nextButton").disabled = answerState != 1; // enabled only on state 1, correct
    
    logParameters (nodeId, givenParams);
}
