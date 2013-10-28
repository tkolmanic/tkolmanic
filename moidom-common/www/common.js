var SERVER_BASE_URL = ""; // the comments in the next few lines have keywords that are to be synchronized with deployment scripts
// search for string 'uncommented by' in the text and script files
SERVER_BASE_URL = "/server_prod/"; // keyword prod_webapp
//SERVER_BASE_URL = "/server_test/";  // keyword test_webapp
//SERVER_BASE_URL = "http://localhost:8080/server_prod/"  // keyword development
SERVER_BASE_URL = "http://www.moidom.si/server_prod/"; // keyword prod_mobile // uncommented by sed script 
//SERVER_BASE_URL = "http://www.moidom.si/server_test/"; // keyword test_mobile
var HTML_URL = ""; // useful for tracking the code that changes URLs

function getDataUrl()
{
    // this is prefix for server call urls
    return SERVER_BASE_URL;
}

function getHtmlUrl()
{
    // this is prefix for sibling html pages
    return HTML_URL;
}

var JSON_STATUS_OK = 0;
var JSON_STATUS_NOT_LOGGED_IN = 4;
var JSON_STATUS_SESSION_EXPIRED = 7;

// the functions checks the 'status', depending on it
// it either changes the web page to the login page (not logged in, no more logged in)
// or shows an error messages (other errors)
// or does nothing special if status is fine
// The functions returns true if the status means an error.
function dataStatusIsBad (status, status_loc)
{
    if (status != JSON_STATUS_OK) {
        if (status == JSON_STATUS_NOT_LOGGED_IN  ||  status == JSON_STATUS_SESSION_EXPIRED) {
            //alert('Niste (več) prijavljeni (status ' + status + '), sledi začetna stran');
            top.location.href = HTML_URL + 'index.html';
        } else {
            alert('Pošiljanje podatkov ni uspelo, strežnik je vrnil napako: ' + status_loc);
        }
        return true;
    }
    return false;
}


function ajaxError(data, textStatus, xhr)
{
    alert('Povezava s strežnikom trenutno ni dosegljiva.');
}

function localizeDecimal (decimal)
{
    return decimal.toString().replace('.', ',');
}

function parseDecimal (decimalString)
{
    return parseFloat(decimalString.replace(',', '.'));
}


function zeroToEmpty (numberAsString)
{
    return numberAsString == '0' ? '' : numberAsString;
}


function firstNonEmpty (a,b)
{
    if (a != '') {
        return a;
    }
    return b;
}


function parseDateTime(dateValue, dateFormat, timeValue, timeFormat) {
    var dateFmt = new Array(), timeFmt = new Array();
    var i = 0, j = 0;
    var dateParts = dateValue.match(/(\d+)/g);
    var timeParts = timeValue.match(/(\d+)/g);
    dateFormat.replace(/(yyyy|dd|mm)/g, function(part) { dateFmt[part] = i++; });
    timeFormat.replace(/(hh|mm|ss)/g, function(part) { timeFmt[part] = j++; });
    var date = new Date(dateParts[dateFmt['yyyy']], dateParts[dateFmt['mm']] - 1, dateParts[dateFmt['dd']],
                        timeParts[timeFmt['hh']], timeParts[timeFmt['mm']], timeParts[timeFmt['ss']]);
    return date.getTime();
}


function addValidators()
{
    $.validator.addMethod("moidomRequired", function(value, element) {
        return /^.+$/i.test(value);
    }, "Ta podatek je obvezen.");
    $.validator.addMethod("moidomPositiveInt", function(value, element) {
        return this.optional(element) || /^[0-9]\d*$/i.test(value);
    }, "Vnesi celo število, brez decimalk.");
    $.validator.addMethod("moidomPostalCode", function(value, element) {
        return this.optional(element) || /^[1-9]\d{3}$/i.test(value);
    }, "Vnesi 4-mestno poštno številko.");
    $.validator.addMethod("moidomDecimal", function(value, element) {
        return this.optional(element) || /^\d+([,\.]\d+)?$/i.test(value);
    }, "Vnesi celo ali decimalno število, decimalka je vejica ali pika.");
}


// The function returns true if it detects a mobile operating system environment
function isMobileEnvironment()
{
    if ( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
        return true;
    }
    if (window.innerWidth <= 800 && window.innerHeight <= 600) {
        //alert ("isMobileEnvironment returning true on screen size");
        return true;
    }
    return false;
}


function isIosEnvironment()
{
    if ( /iPhone|iPad|iPod/i.test(navigator.userAgent) ) {
        return true;
    }
    return false;
}


function updateButtonsWithImages()
{
    /*
     * As of autumn 2013, there is no single unique way to have clickable buttons showing as images
     they're represented as 'img' elements and on older androids,
     converted into texts
     */
    //alert ('updateButtonsWithImages starting, user agent '+navigator.userAgent);
    if ( !(/Android 2/i.test(navigator.userAgent)) ) {
        return; // disabled for all other cases
    }
    $('img.withImage').each(function( index ) {
        var altText = $(this).attr('alt');
        var parent = $(this).parent();
        parent.empty ();
        var spanElement = $('<span class="btn btn-primary margin5"/>').appendTo(parent);
        spanElement.text (altText);
        //console.log('(updateButtonsWithImages '+index + ': alt="' + altText+'")');
        }
    );
    //console.log ('updateButtonsWithImages finished');
}



/* The function shows or hides (depending on 'hide' argument) the 'element' */
function showOrHide(element, show)
{
    if (show)
        element.show();
    else
        element.hide();
}


/* The function shows or hides (depending on 'hide' argument) the 'element' */
function showOrHideById(elementId, show)
{
    if (show)
        $('#'+elementId).show();
    else
        $('#'+elementId).hide();
}
