//
// VARIABLES
//
// PhoneGap Ready variable. Initialized to 'false' (device not ready) and
// set to 'true' when the device is ready.
var pgReady = false;

var DATA_URL = getDataUrl(); // in common.js
var HTML_URL = "";

var currentCommodityId = 0;  // remembers the last selected commodity; == 0 when no commodity, >= 1 actual value
var assignedCommodityIdList = // IDs of <select> lists that show assigned commodities per user 
    ['#submitCommodity', '#importCommodity', '#viewCommodity'];
var assignedCommodityCount = 0; // total number of assigned commodities to a user
var assignedCommodities = []; // empty list for now

var GRAPH_NONE = 0;
var GRAPH_EFFICIENCY = 1;
var GRAPH_PERCENTILES = 2;
var GRAPH_NONCUMULATIVE = 3;
var GRAPH_CUMULATIVE = 4;
var selectedGraph = 0; // 0 to GRAPH_CUMULATIVE

// the function updates the contents of indicator texts and selected graph
function updateIndicatorsAndGraph(updateUnits) {
    if (assignedCommodityCount == 0)
        return;
    updateCurrentCommodity ($('#viewCommodity').val(), updateUnits);
    showIndicatorValues();
    if (selectedGraph == GRAPH_EFFICIENCY) {
        plotEfficiencyClasses();
    }
    if (selectedGraph == GRAPH_PERCENTILES) {
        plotAndShowPercentiles();
    }
    if (selectedGraph == GRAPH_NONCUMULATIVE) {
        plotComodityData('#viewTimeseqIncr', '#totalUserValue1', false);
    }
    if (selectedGraph == GRAPH_CUMULATIVE) {
        plotComodityData('#viewTimeseqCumul', '#totalUserValue2', true);
    }
};


function updateCurrentCommodity (commodityId, updateUnits)
{
    currentCommodityId = commodityId;
    if (updateUnits) {
        populateEfficiencyUnit (currentCommodityId);
    }                
}


// The function updates the selected commodity in all <select>s
function updateCommoditySelection () {
    if (currentCommodityId > 0) {
        for (var i=0; i<assignedCommodityIdList.length; i++) {
            $(assignedCommodityIdList[i]).val(currentCommodityId);
        }
    }
}


$(document).ready(function() {
    // Register the event handler 
    document.addEventListener("deviceready", onDeviceReady, false);
    
    updateButtonsWithImages();

    addValidators();
    
    // Initialize datepicker and timepicker
    $('#submitDate').datepicker('setValue', new Date());
    $('#submitTime').timepicker();
    $('#startDate').datepicker('setValue', new Date());
    $('#startTime').timepicker();

    // Populate the input form for the first time
    populateAssignedCommodities();

    if (isMobileEnvironment()) {
        $('#mainTabs #tabMobile').tab('show');
    }
    
    if (!isIosEnvironment()) {
        $('#ios7statusBarPadding').attr ('style', 'margin-top:0px');
    }
    
    // Connect tabs' show events
    $('#tabSubmit').on('show', function() {
        updateCommoditySelection();
    });
    $('#tabSingleSubmit').on('show', function() {
        updateCommoditySelection();
        $('submitTime').timepicker('setTime', formatTime(new Date()));
        $('submitDate').datepicker('setValue', new Date());
    });
    $('#tabImport').on('show', function() {
        updateCommoditySelection();
    });
    $('#tabView').on('show', function() {
        updateCommoditySelection();
        populateTagLists('viewTag', 'assigned');
        updateIndicatorsAndGraph(true);
    });
    $('#tabSettings').on('show', function() {
        showSettingsTab (0, -2);
    });

    // Connect graphs' show events
    $('#commodityViewEffClass').on('show', function() {
        selectedGraph = GRAPH_EFFICIENCY;
        updateIndicatorsAndGraph(false);
    });
    $('#commodityViewPercentile').on('show', function() {
        selectedGraph = GRAPH_PERCENTILES;
        updateIndicatorsAndGraph(false);
    });
    $('#commodityViewTimeseqIncr').on('show', function() {
        selectedGraph = GRAPH_NONCUMULATIVE;
        updateIndicatorsAndGraph(false);
    });
    $('#commodityViewTimeseqCumul').on('show', function() {
        selectedGraph = GRAPH_CUMULATIVE;
        updateIndicatorsAndGraph(false);
    });

    populateUserData();

    // Validate the input form: Enter consumption data  [Tab: Submit]
    $('#formSubmit').validate({
        rules:
        {
            submitCommodity: {required: true},
            submitDate: {moidomRequired: true},
            submitTime: {moidomRequired: true},
            submitValue: {moidomRequired: true}
        },
        submitHandler: function(form)
        {
            var requestData = {
                time: parseDateTime($('#submitDate').val(), 'dd.mm.yyyy', $('#submitTime').val(), 'hh:mm:ss'),
                commodity: $('#submitCommodity').val(),
                value: $('#submitValue').val().replace(',', '.')
            };
            var updateExisting = $('#updateExisting').is(':checked');
            $.ajax({
                url: DATA_URL + 'entry/' + (updateExisting ? 'update' : 'store'),
                type: 'POST',
                data: requestData,
                xhrFields: { withCredentials: true },
                success: function(data, textStatus, xhr)
                {
                    if (dataStatusIsBad (data.status, data.status_loc))
                        return; 
                    $('#submitValue').val('');
                    $('#mainTabs #tabView').tab('show');
                },
                error: ajaxError
            });
        }
    });
    
    $('#formImport').ajaxForm({
        url: DATA_URL + 'entry/file_store',
        type: 'POST',
        data: { format: 'CSV' },
        dataType: 'json',
        xhrFields: { withCredentials: true },
        success: function(data, textStatus, xhr)
        {
            if (dataStatusIsBad (data.status, data.status_loc))
                return; 
            $('#formImport :file').clearFields();
            alert('Podatki so uvoženi. Poslana vam je bila elektronska pošta z navodili za preklic uvoza.');
        },
        error: ajaxError
    });
                    
    // Validate the input form: Modify user data
    $("#formUserSettings").validate({
        rules:
        {
            password: {required: false, minlength: 5, maxlength: 50},
            confPassword: {required: false, minlength: 5, maxlength: 50, equalTo: "#password"},
            area: {moidomRequired: true, moidomPositiveInt: true},
            persons: {moidomRequired: true, moidomPositiveInt: true},
            in_power: {moidomPositiveInt: true},
            postal_code: {moidomPostalCode: true},
            out_power: {moidomDecimal: true},
        },
        submitHandler: function(form)
        {
            var requestData = {
                password: $('#password').val(),
                area: $('#area').val(),
                persons: $('#persons').val(),
                in_power: firstNonEmpty ($('#in_power').val(), '0'),
                postal_code: firstNonEmpty ($('#postal_code').val(), '0'),
                out_power: firstNonEmpty ($('#out_power').val().replace(',', '.'), '0')
            };
            $.ajax({
                url: DATA_URL + 'user/update_profile',
                type: 'POST',
                data: requestData,
                xhrFields: { withCredentials: true },
                success: function(data, textStatus, xhr)
                {
                    if (dataStatusIsBad (data.status, data.status_loc))
                        return; 
                    alert('Podatki posodobljeni!');
                },
                error: ajaxError
            });
        }
    });

    $('#formAssignCommodity').validate({
        rules:
        {
            cumulative: { required: true },
            startValue: { moidomRequired: true, minlength: 1, maxlength: 50 },
            startDate: { moidomRequired: true },
            startTime: { moidomRequired: true },
            unassignedCommodities: { required: true, number: true }
        },
        submitHandler: function(form) {
            var commodityId = $('#unassignedCommodities').val();
            var requestData = {
                cumulative: ($('#cumulativeTrue').prop('checked') ? 'true' : 'false'),
                start_value: $('#startValue').val(),
                commodity: commodityId,
                start_time: parseDateTime($('#startDate').val(), 'dd.mm.yyyy', $('#startTime').val(), 'hh:mm:ss')
            }
            $.ajax({
                url: DATA_URL + 'user/assign_commodity',
                type: 'POST',
                data: requestData,
                xhrFields: { withCredentials: true },
                success: function(data, textStatus, xhr)
                {
                    if (dataStatusIsBad (data.status, data.status_loc))
                        return; 
                    updateCurrentCommodity (commodityId, true);
                    populateAssignedUnassignedCommodities();
                    populateAssignedCommodities();
                    setAssignCommodityDependants();
                    $('#mainTabs #tabSubmit').tab('show');
                },
                error: ajaxError
            });
        }
    });
});

function onDeviceReady() {
    // Set pgReady.
    pgReady = true;
    setPicSourceType();
}
 

/// The function shows a tab (menu contents)
/// 'tabId' is ID of tab element without a leading '#'
function showBasicTab (tabId) {
  $('#mainTabs #' + tabId).tab('show');
}
      
/// the functions shows the tab (menu screen), called in mobile
/// environment after login
function showMobileTopMenu () {
    showBasicTab ('tabMobile');
}
 
/// The functions shows wanted part of View tab
/// the argument 'partToshow' has the following values
/*
GRAPH_NONE = 0;
GRAPH_EFFICIENCY = 1;
GRAPH_PERCENTILES = 2;
GRAPH_NONCUMULATIVE = 3;
GRAPH_CUMULATIVE = 4;
*/
function showViewTab (partToShow)
{
    if (partToShow > 0) {
        selectedGraph = partToShow;
        updateIndicatorsAndGraph(false);
    }
    var isMobile = isMobileEnvironment();
    showBasicTab ('tabView');
    showOrHideById('viewBack', partToShow == 0  && isMobile);
    showOrHideById('viewForm', partToShow == 0  ||  !isMobile);
    showOrHideById('viewEffClassButton', partToShow == 0);
    showOrHideById('viewEffClassContent', partToShow == GRAPH_EFFICIENCY);
    showOrHideById('viewPercentileButton', partToShow == 0);
    showOrHideById('viewPercentileContent', partToShow == GRAPH_PERCENTILES);
    showOrHideById('viewTimeseqIncrButton', partToShow == 0);
    showOrHideById('viewTimeseqIncrContent', partToShow == GRAPH_NONCUMULATIVE);
    showOrHideById('viewTimeseqCumulButton', partToShow == 0);
    showOrHideById('viewTimeseqCumulContent', partToShow == GRAPH_CUMULATIVE);
}

/** The functions shows wanted part of Settings tab
 the argument 'partToshow' has the following values
 0 main tab content
 1 commodities
 2 tags
 3 user
 the argument 'actionIx'is used with partToShow values 1 and 2 and has the following values
 -2: show the initial list with "add" button and existing entries
 -1: show the "add" dialog
 0..end: show the "details" dialog for the indexed entry
*/
function showSettingsTab (partToShow, actionIx)
{
    //alert ('showSettingsTab '+partToShow+' '+ actionIx);
    //showBasicTab ('tabSettings');
    if (partToShow == 1 &&  actionIx == -2) {
        populateAssignedUnassignedCommodities();
    }
    if (partToShow == 2 &&  actionIx == -2) {
        populateAssignedUnassignedTags();
    }
    var isMobile = isMobileEnvironment();
    
    showOrHideById('settingsBack', (partToShow == 0 || actionIx == -2) && isMobile);
    showOrHideById('settingsSubMenu', partToShow == 0 || actionIx == -2);
    
    showOrHideById('commoditySettingsDefault', partToShow == 1 &&  actionIx == -2);
    showOrHideById('commoditySettingsAdd', partToShow == 1 &&  actionIx == -1);
    if (partToShow == 1 &&  actionIx >= 0) {
        // commodityItemNameId_ IS SET IN FUNCTION populateCommodityLists
        var idString = '#commodityItemNameId_'+actionIx;
        var commodityId = $(idString).data('commodityId');        
        var paramIx = '(' + commodityId + ')';
        $('#commoditySettingsEditCommodity').html ($(idString).html());
        var importKey = $(idString).data('importKey');
        $('#commoditySettingsEditCode').html (importKey!=null? importKey : 'ni na voljo.');        
        $('#commoditySettingsEditRemove').attr ('onclick', 'unassignCommodityAsk'+paramIx);
        $('#commoditySettingsEditEnable').attr ('onclick', 'enableCommodityImportAsk'+paramIx);
        var enableImport = $(idString).data('enable')!=0;
        var disableImport = $(idString).data('disable')!=0;
        //alert ('data 1 idString enable disable = '+ idString+' '+  enableImport+' '+ disableImport);
        showOrHideById('commoditySettingsEditEnable', enableImport);
        $('#commoditySettingsEditDisable').attr ('onclick', 'disableCommodityImportAsk'+paramIx);
        showOrHideById('commoditySettingsEditDisable', disableImport);
    }
    showOrHideById('commoditySettingsEdit', partToShow == 1 &&  actionIx >= 0);
    showOrHideById('assignedCommodities', partToShow == 1 &&  actionIx != -1);
    
    showOrHideById('tagSettingsDefault', partToShow == 2 &&  actionIx == -2);
    showOrHideById('tagSettingsAdd', partToShow == 2 &&  actionIx == -1);
    if (partToShow == 2 &&  actionIx >= 0) {
        // tagItemNameId_ IS SET IN FUNCTION populateTagLists
        var idString = '#tagItemNameId_'+actionIx;
        var tagId = $(idString).data('tagId');        
        var paramIx = '(' + tagId + ')';
        $('#tagSettingsEditTag').html ($(idString).html());
        $('#tagSettingsEditRemove').attr ('onclick', 'unassignTagAsk'+paramIx);
    }    
    showOrHideById('tagSettingsEdit', partToShow == 2 &&  actionIx >= 0);
    showOrHideById('assignedTags', partToShow == 2 &&  actionIx != -1);
    
}

/// The function shows a tab (menu contents)
/// 'tabId' is ID of tab element without a leading '#'
function showTab (tabId) {
    //alert ('showTab '+tabId)
    showBasicTab(tabId);
    if (tabId == 'tabSettings') {
        showSettingsTab (0, -2);
    }
}
          
function restartConsulting () {
    $('#consultFrame').attr('src', 'svetovanje/start.html');
}

// The function processes a click on icon in top mobile menu
function processMobileTopMenuClick(iconId, tabId)
{
    // the first few commodities (id from 1 to 6) have the abbreviations
    // listed after 'o' 
    var iconIds = ['o', 'ee', 'ek', 'te', 'tk', 've', 'vk'];
    var commodityId = iconIds.indexOf (iconId);
    if (commodityId > 0) {
        updateCurrentCommodity (commodityId, true);
    }
    showTab(tabId);
}


function genMobileMenuHtml (name, nameSuffix, iconId, iconSuffix, tabId)
{
    var result =            
        '<a class="mobileIcon" onclick="processMobileTopMenuClick(\''+iconId+'\', \'' + tabId +
        '\')"><img src="img/mobile/' + iconId + iconSuffix + '.png" title="' + name + nameSuffix + '"></a>\n';
    return result;                    
}


function genMobileMenuPair (name, iconId)
{
    var s1 = genMobileMenuHtml (name, ' - vnos', iconId, 'v', 'tabSubmit');
    var s2 = genMobileMenuHtml (name, ' - prikaz', iconId, 'p', 'tabView');
    return s1 + s2;
}

// The function updates the contents of #mobileActions based on assigned 'commodities'
function updateMobileTopMenu (commodities)
{
    var comLength = commodities.length;
    var actionHtml = '';
    var anyOther = false;
    for (var i=0; i<comLength; i++) {
        var name = commodities[i].name;
        var iconId = commodities[i].icon_id;
        if (iconId == 'o') {
            anyOther = true; // 'o' ostale obremenitve
            continue;
        }
        actionHtml += genMobileMenuPair (name, iconId);
    }
    if (anyOther)
        actionHtml += genMobileMenuPair ('Ostalo', 'o');
    $('#mobileActions').html(actionHtml);
            }
            
 
            //----------------------------------------------------------------------
// The function shows the indicator values, yearly, monthly and daily.
function showIndicatorValues() {
    var commodityId = currentCommodityId;
    var efficiencyUnit = $('#viewEfficiencyUnit').val();
    var efficiencyPeriod = $('#viewEfficiencyPeriod').val();
    var commodityUnit = $('#viewCommodity').find(':selected').data('unit');

    $.ajax({
        url: DATA_URL + 'entry/efficiency',
        type: 'GET',
        data: {
            commodity: commodityId,
            indicator_unit: efficiencyUnit,
            period_type: efficiencyPeriod
        },
        xhrFields: { withCredentials: true },
        success: function(data, textStatus, xhr)
        {
            if (dataStatusIsBad (data.status, data.status_loc))
                return; 
            var monthlyValue = Math.round (data.value / 12 * 100) / 100;
            var dailyValue = Math.round (data.value / 365 * 100) / 100;
            var totalUnit = ' ' + commodityUnit + getEfficiencyUnitText();
            $('#indicatorValueYearly').text(localizeDecimal(data.value) + totalUnit);
            $('#indicatorValueMonthly').text(localizeDecimal(monthlyValue) + totalUnit);
            $('#indicatorValueDaily').text(localizeDecimal(dailyValue) + totalUnit);
        },
        error: ajaxError
    });
}


//the function sets the width and height of plot element based on window size
//and returns the width in pixels
function setPlotCanvasSize (hashedElementId) {
 var widthPx = window.innerWidth * 0.9;
 if (widthPx > 100) {
     widthPx-=20;
 }
 widthPx = Math.round (widthPx);
 var heightPx = Math.round (widthPx / 2);
 if (heightPx < 200)
     heightPx = 200;
 var styleValue = 'width:'+widthPx+'px;height:'+heightPx+'px;';
 $(hashedElementId).attr ('style', styleValue);
 return widthPx;
}

//----------------------------------------------------------------------
// The function plots the efficiency class graph, if available
function plotEfficiencyClasses() {
    var commodityId = $('#viewCommodity').val();
    var efficiencyUnit = $('#viewEfficiencyUnit').val();
    var efficiencyPeriod = $('#viewEfficiencyPeriod').val();
    var unit = $('#viewCommodity').find(':selected').data('unit');

    $.ajax({
        url: DATA_URL + 'entry/efficiency',
        type: 'GET',
        data: {
            commodity: commodityId,
            indicator_unit: efficiencyUnit,
            period_type: efficiencyPeriod
        },
        xhrFields: { withCredentials: true },
        success: function(data, textStatus, xhr)
        {
            if (dataStatusIsBad (data.status, data.status_loc))
                return;
            if (!showHide2 (data.levels.length > 0, '#effClassShown', '#effClassHidden'))
                return;
            var increasing = data.increasing;
            var plotOptions = {
                yaxis: {
                    min: 0,
                    max: data.levels.length,
                    ticks: new Array() // fill-in during data processing
                },
                xaxis: {
                    ticksLength: 0,
                    ticks: false,
                }
            };

            var plotData = new Array();
            var captions = new Array();
            var fixedBarWidth = 10;
            for (var i = 0; i < data.levels.length; i++) {
                var lineWidth = (data.efficiency_class == data.levels[i].name ? 3 : 0);
                plotData.push({
                    color: 'rgb(0,0,0)',
                    data: [ [fixedBarWidth + i, data.levels.length - 1 - i] ],
                    bars: {
                        horizontal: true,
                        show: true,
                        barWidth: 1,
                        align: "left",
                        fillColor: data.levels[i].color,
                        lineWidth: lineWidth
                    }
                });
                plotOptions.yaxis.ticks.push( [ (data.levels.length - 0.5 - i), (data.levels[i].name) ]);

                // Draw the line of the user's value as new line-series (note overlays, code order important)
                if (data.efficiency_class == data.levels[i].name) {
                    var offset = 1 - (data.value - data.levels[i].min) / (data.levels[i].max - data.levels[i].min);
                    plotData.push({
                        color: 'rgb(0,0,0)',
                        data: [ [0, data.levels.length - offset - i], [fixedBarWidth + i, data.levels.length - offset - i] ],
                        lines: {
                            show: true,
                            lineWidth: 1
                        },
                        shadowSize: 0
                    });
                }
                var rangeText = localizeDecimal(data.levels[i].min) + ' - ' + localizeDecimal(data.levels[i].max);
                if (i + 1 == data.levels.length  &&  increasing) {
                    rangeText = '> ' + localizeDecimal(data.levels[i].min);
                }
                if (i == 0  &&  !increasing) {
                    rangeText = '> ' + localizeDecimal(data.levels[i].max);
                }

                // Remember series value interval for later unit printout
                captions.push(rangeText + ' ' + unit + getEfficiencyUnitText() + "/leto");
            }

            var hashedPlotHolder = '#viewEffClassHistogram';
            setPlotCanvasSize (hashedPlotHolder);
            var plot = $.plot($(hashedPlotHolder), plotData, plotOptions);

            // Print out units
            for (var i = 0; i < captions.length; i++) {
                var o = plot.pointOffset({ x: 0.5, y: captions.length - i - 0.2});
                $('#viewEffClassHistogram').append("<div style='position:absolute;left:" + 
                (o.left + 4) + "px;top:" + o.top + "px;color:#000;font-size:smaller'>" + captions[i] + "</div>");
            }
        },
        error: ajaxError
    });
}


/// The function updates (optionally removes) real numbers in axis.ticks
/// that will (according to a heuristics) overlap with another
///  value when plotted in an area wide 'totalPx' pixels and expected
/// 'digitPx' pixels for a single digit
/// and moreover the real range is from minValue to maxValue
/// The values in 'axis.ticks' are expected to be increasing,
/// minValue is expected to be lower than maxValue
function tidyOverlappingTicks (axis, minValue, maxValue, totalPx, digitPx) {
    //console.log ('tidyOverlappingLabels start '+axis.ticks);
    var filteredTicks = new Array();
    var lastPx = -1; // the ending pixel position of the last value 
    for (var i = 0; i < axis.ticks.length; i++) {
        var value = axis.ticks[i];
        var startPx = (value-minValue) / (maxValue-minValue) * totalPx;
        var skipped = startPx < lastPx;
        var valueStr = value.toString();
        var endPx = startPx + valueStr.length * digitPx;
        if (lastPx < endPx &&  !skipped)
            lastPx = endPx;
        //console.log ('tidyOverlappingLabels value '+valueStr+': skipped? '+skipped);
        if (!skipped) {
            filteredTicks.push (value);
        }
    }
    //console.log ('tidyOverlappingLabels done');
    axis.ticks = filteredTicks;
}


//----------------------------------------------------------------------
// The function plots the percentile graph and updates associated texts. 
function plotAndShowPercentiles() {
    $.ajax({
        url: DATA_URL + 'entry/efficiency',
        type: 'GET',
        data: {
            commodity: $('#viewCommodity').val(),
            indicator_unit: $('#viewEfficiencyUnit').val(),
            period_type: $('#viewEfficiencyPeriod').val(),
            tag: $('#viewTag').val()
        },
        xhrFields: { withCredentials: true },
        success: function(data, textStatus, xhr)
        {
            if (dataStatusIsBad (data.status, data.status_loc))
                return; 
            if (!showHide2 (data.levels.length > 0, '#percentileShown', '#percentileHidden'))
                return;
            var plotOptions = {
                xaxis: {
                    min: 0,
                    ticks: new Array() // fill-in during data processing
                }
            };

            var plotData = new Array();
            var maxX = 0.0;
            for (var i = 0; i < data.levels.length; i++) {
                plotData.push({
                    data: [ [ data.levels[i].min, data.levels[i].count ] ],
                    bars: {
                        show: true,
                        barWidth: (data.levels[i].max - data.levels[i].min),
                        align: "left",
                        fillColor: data.levels[i].color,
                        lineWidth: 0
                    }
                });
                isLast = i+1 == data.levels.length;
                maxX = data.levels[i].max;
                if (!isLast) {
                    plotOptions.xaxis.ticks.push( data.levels[i].max );
                }

                // Draw the line of the user's value as new line-series (note overlays, code order important)
                if (data.efficiency_class == data.levels[i].name) {
                    plotData.push({
                        color: 'rgb(0,0,0)',
                        data: [ [data.value, 0], [data.value, data.levels[i].count] ],
                        lines: {
                            show: true,
                            lineWidth: 1
                        },
                        shadowSize: 0
                    });
                }
            }
            
            hashedPlotHolder = '#viewPercentilHistogram';
            var widthPx = setPlotCanvasSize (hashedPlotHolder);
            tidyOverlappingTicks (plotOptions.xaxis, 0, maxX, widthPx, 8);

            var plot = $.plot($(hashedPlotHolder), plotData, plotOptions);

            // Update text fields below percentile graph
            var unit = $('#viewCommodity').find(':selected').data('unit')
                + getEfficiencyUnitText();
            $('#percentileUnit').text(unit);
            $('#indicatorAtPercentile').text(localizeDecimal(data.value) + ' ' + unit);
            $('#userRank').text(data.percentile_rank);
        },
        error: ajaxError
    });
}


// The function plots the cumulative or non-cumulative usage graph.
function plotComodityData(hashedPlotHolder, hashedTotalValueHolder, cumulative) {
    var commodityId = $('#viewCommodity').val();

    $.ajax({
        url: DATA_URL + 'entry/get_sequence',
        type: 'GET',
        data: { 
            commodity: commodityId, 
            cumulative: (cumulative ? 'true' : 'false')
            },
        xhrFields: { withCredentials: true },
        success: function(data, textStatus, xhr)
        {
            if (dataStatusIsBad (data.status, data.status_loc))
                return; 
            var plotOptions = {
                series:
                {
                    lines: { show: true }
                },
                xaxis:
                {
                    mode: "time",
                    timeformat: "%d.%m.%y"
                }
            };
            if (cumulative) {
                plotOptions.series['points'] = { show: true };
            }

            var plotData = new Array();
            var totalValue = 0.0;
            if (!cumulative) {
                // skip first record
                for (var i = 1; i < data.data.length; i++) {
                    totalValue += data.data[i][1];
                    plotData.push({
                        data: [[ data.data[i-1][0], data.data[i][1] ]],
                        bars: {
                            show: true,
                            barWidth: data.data[i][0] - data.data[i-1][0],
                            align: "left"
                        }
                    });
                }
            } else {
                plotData.push(data.data);
                for (var i = 1; i < data.data.length; i++) {
                    totalValue += data.data[i][1] - data.data[i-1][1];
                }
            }
            setPlotCanvasSize (hashedPlotHolder);
            $.plot($(hashedPlotHolder), plotData, plotOptions);
            var unit = $('#viewCommodity').find(':selected').data('unit');
            $(hashedTotalValueHolder).text(localizeDecimal(totalValue)+' '+unit);
        },
        error: ajaxError
    });
}


// The function updates the confirmation dialog texts (title, body),
// remembers an 'idToPass' (to be passed to server) as .data('id')
// assembles and assigns the onclick attribute and shows the dialog
function showConfirmDialog(idToPass, title, body, onClickStart)
{
    $('#confirmDialogTitle').text(title);
    $('#confirmDialogBody').text(body);
    $('#confirmDialogButton').attr('onclick', 
        onClickStart + "$('#confirmDialog').modal('hide')");                
    $('#confirmDialog').data('id', idToPass);
    $('#confirmDialog').modal('show');
}

function unassignCommodityAsk(commodityId)
{
    showConfirmDialog (commodityId, 'Brisanje obremenitve',
        'Ali res želite pobrisati izbrano obremenitev in njene odčitke iz vašega seznama?',
        "unassignCommodity($('#confirmDialog').data('id'));showSettingsTab (1,-2);");
}


function enableCommodityImportAsk(commodityId)
{
    showConfirmDialog (commodityId, 'Omogoči uvoz odčitkov',
        'Ali res želite omogočiti samodejen uvoz podatkov za izbrano obremenitev?',
        "setupCommodityImport($('#confirmDialog').data('id'),true);showSettingsTab (1,-2);");                
}

function disableCommodityImportAsk(commodityId)
{
    showConfirmDialog (commodityId, 'Onemogoči uvoz odčitkov',
        'Ali res želite onemogočiti samodejen uvoz podatkov za izbrano obremenitev?',
        "setupCommodityImport($('#confirmDialog').data('id'),false);showSettingsTab (1,-2);");
}

function unassignTagAsk(id)
{
    showConfirmDialog (id, 'Brisanje označbe',
        'Ali res želite pobrisati izbrano označbo iz vašega seznama in se odjaviti od skupine?',
        "unassignTag($('#confirmDialog').data('id'));showSettingsTab (2,-2);");                
}

function unassignCommodity(id)
{
    $.ajax({
        url: DATA_URL + 'user/unassign_commodity',
        type: 'POST',
        data: { commodity: id },
        xhrFields: { withCredentials: true },
        success: function(data, textStatus, xhr)
        {
            if (dataStatusIsBad (data.status, data.status_loc))
                return; 
            populateAssignedUnassignedCommodities();
            populateAssignedCommodities();
        },
        error: ajaxError
    });
}

function setupCommodityImport(commodityId, value)
{
    $.ajax({
        url: DATA_URL + 'user/setup_fast_store',
        type: 'POST',
        data: { commodity: commodityId, 
            enabled: value },
        xhrFields: { withCredentials: true },
        success: function(data, textStatus, xhr)
        {
            if (dataStatusIsBad (data.status, data.status_loc))
                return; 
            populateAssignedUnassignedCommodities();
            populateAssignedCommodities();
        },
        error: ajaxError
    });
}


function assignTag(el) {
    var id = $('#' + el).val();
    if (id != null) {
        $.ajax({
            url: DATA_URL + 'user/assign_tag',
            type: 'POST',
            data: { tag: id },
            xhrFields: { withCredentials: true },
            success: function(data, textStatus, xhr)
            {
                if (dataStatusIsBad (data.status, data.status_loc))
                    return; 
                populateAssignedUnassignedTags();
            },
            error: ajaxError
        });
    }
}

function unassignTag(id)
{
    $.ajax({
        url: DATA_URL + 'user/unassign_tag',
        type: 'POST',
        data: { tag: id },
        xhrFields: { withCredentials: true },
        success: function(data, textStatus, xhr)
        {
            if (dataStatusIsBad (data.status, data.status_loc))
                return; 
            populateAssignedUnassignedTags();
        },
        error: ajaxError
    });
}


/// The function sets the hint to hintString and shows or hides the main content
function showHide4 (hintId, contentId, hintHtmlString, contentVisible)
{
    $(hintId).html (hintHtmlString);
    if (contentVisible)
        $(contentId).show();
    else
        $(contentId).hide();
}


/// The function shows either main contents or alternative text
/// and returns back the condition.
function showHide2 (condition, contentsId, alternativeId)
{
    if (condition) {
        $(alternativeId).hide();
        $(contentsId).show();
    } else {
        $(alternativeId).show();
        $(contentsId).hide();
    }
    return condition;
}


// The function updates the #viewEfficiencyUnit list with units suitable to the specified commodity
function populateEfficiencyUnit (commodityId)
{
    // the first two units are fixed, the third one is changeable
    thirdUnit = 2;
    for (var i=0; i < assignedCommodities.length; i++) {
        if (assignedCommodities[i].id == commodityId) {
            thirdUnit = assignedCommodities[i].indicator_unit3;
        }
    }
    var thirdText = thirdUnit == 2 ? 'po osebi' : 'po generirani moči';
    unitList = [
        [0, 'nominalno'], 
        [1, 'po površini'],
        [thirdUnit,thirdText]];                

    unitListid = '#viewEfficiencyUnit';
    var el = document.getElementById(unitListid.substr(1));
    $(unitListid).empty();
    var listHtml = '';
    for (var i = 0; i < unitList.length; i++) {
        var unit = unitList[i];
        listHtml += '<option value="' + unit[0] + '" ' + '>' + unit[1] + '</option>';
    }
    $(unitListid).append(listHtml);                
}


function getEfficiencyUnitText()
{
    var efficiencyUnitId = $('#viewEfficiencyUnit').val();
    var efficiencyUnit = '';
    if (efficiencyUnitId == 1)
        efficiencyUnit = '/m2';
    if (efficiencyUnitId == 2)
        efficiencyUnit = '/osebo';
    if (efficiencyUnitId == 3)
        efficiencyUnit = '/kW';
    return efficiencyUnit;
}


// The function updates all the commodity lists with their ids 'idList'
// by calling user/list_commodities with type set to 'listType'
// and finally calling function as specified by parameter 'oncomplete'
function populateCommodityLists(idList, listType, oncomplete)
{
    $.ajax({
        url: DATA_URL + 'user/list_commodities',
        type: 'GET',
        data: { type: listType },
        xhrFields: { withCredentials: true },
        success: function(data, textStatus, xhr)
        {
            if (dataStatusIsBad (data.status, data.status_loc))
                return; 
            if (listType == 'assigned') {
                assignedCommodityCount = data.commodities.length;
                assignedCommodities = data.commodities;
                var hintHtmlString = '';
                var contentVisible = true;
                if (assignedCommodityCount == 0) {
                    updateCurrentCommodity (0, true);
                    hintHtmlString = 'Na meniju <a href="#Settings" onclick="showSettingsTab(0,-2)">' + 
                        'Nastavitve</a>&gt Obremenitve ' +
                        'dodajte obremenitev, potem vnesite podatke.';
                    contentVisible = false;
                }
                showHide4 ('#viewUnavailableHint', '#viewContents', hintHtmlString, contentVisible);
                showHide4 ('#submitUnavailableHint', '#formSubmit', hintHtmlString, contentVisible);
                showHide4 ('#importUnavailableHint', '#formImport', hintHtmlString, contentVisible);
                updateMobileTopMenu (data.commodities);
            }
            for (var j=0; j < idList.length; j++) {
                commodityListid = idList[j]; // includes intial hash (#)
                var el = document.getElementById(commodityListid.substr(1));
                $(commodityListid).empty();

                for (var i = 0; i < data.commodities.length; i++) {
                    var commodity = data.commodities[i];
                    var selected = (currentCommodityId == commodity.id ? " selected" : "");
                    var importKey = commodity["import_id"];
                    var cumulative = commodity.cumulative;
                    if (el.nodeName == "SELECT") {
                        $(commodityListid).append('<option value="' + commodity.id + '" data-unit="' + commodity.unit + 
                            '" data-cumulative="' + commodity.cumulative + '" ' + selected + '>' + commodity.name + '</option>');
                    } else if (el.nodeName == "UL") {
                        // THE FUNCTION showSettingsTab USES THE 'ID' ATTRIBUTES DEFINED HERE
                        var idString = 'commodityItemNameId_'+i;
                        var nameHtml = '<span id="' + idString
                            +'" class="clickable"'
                            +' onclick="showSettingsTab(1,'+i+')"'
                            +'>' + commodity.name + '</span>';
                        $(commodityListid).append('<li>' + nameHtml + '</li>');
                        $('#'+idString).data ('enable', importKey == null && cumulative?'1':'0');
                        $('#'+idString).data ('disable', importKey != null?'1':'0');
                        $('#'+idString).data ('importKey', importKey);
                        $('#'+idString).data ('commodityId', commodity.id);
                    }
                }
            }

            if (oncomplete)
                oncomplete();
        },
        error: ajaxError
    });
}


function populateAssignedCommodities() {
    // several lists with the same content in different part of application, all as SELECT
    populateCommodityLists(assignedCommodityIdList, 'assigned', updateSubmitForm);
}


function populateAssignedUnassignedCommodities() {
    // both lists at setup menu, already assigned as UL and noy yet assigned as SELECT
    populateCommodityLists(['#assignedCommodities'], 'assigned', null);
    populateCommodityLists(['#unassignedCommodities'], 'unassigned', setAssignCommodityDependants);
}


function populateTagLists(tagElemId, tagType)
{
    $.ajax({
        url: DATA_URL + 'user/list_tags',
        data: { type: tagType },
        type: 'GET',
        xhrFields: { withCredentials: true },
        success: function(data, textStatus, xhr)
        {
            if (dataStatusIsBad (data.status, data.status_loc))
                return; 
            var el = document.getElementById(tagElemId);
            var hashedTagElemId = '#' + tagElemId;
            $(hashedTagElemId).empty();

            for (var i = 0; i < data.tags.length; i++) {
                var tag = data.tags[i];
                if (el.nodeName == "SELECT") {
                    $(hashedTagElemId).append('<option value="' + tag.id + '">' + tag.name + '</option>');
                } else if (el.nodeName == "UL") {
                    // THE FUNCTION showSettingsTab USES THE 'ID' ATTRIBUTES DEFINED HERE
                    var idString = 'tagItemNameId_'+i;
                    var nameHtml = '<span id="' + idString
                        +'" class="clickable"'
                        +' onclick="showSettingsTab(2,'+i+')"'
                        +'>' + tag.name + '</span>';
                    $(hashedTagElemId).append('<li>' + nameHtml + '</li>');
                    $('#'+idString).data ('tagId', tag.id);
                }
            }
        },
        error: ajaxError
    });
}


function populateAssignedUnassignedTags() {
    populateTagLists('assignedTags', 'unassignable'); 
    populateTagLists('unassignedTags', 'unassigned')            
}


function populateUserData() {

    $.ajax({
        url: DATA_URL + 'user/get_profile',
        type: 'GET',
        xhrFields: { withCredentials: true },
        success: function(data, textStatus, xhr)
        {
            if (dataStatusIsBad (data.status, data.status_loc))
                return; 
            $('#updateUserEmail').text(data.email);
            $('#area').val(data.area);
            $('#persons').val(data.persons);
            $('#in_power').val(zeroToEmpty(data.in_power));
            $('#postal_code').val(zeroToEmpty(data.postal_code));
            $('#out_power').val(zeroToEmpty(localizeDecimal(data.out_power)));
            $('#logoutText').append(data.email);
        },
        error: ajaxError
    });
}

function formatTime(date) {
    var hh = date.getHours();
    var mm = date.getMinutes();
    var ss = date.getSeconds();
    // These lines ensure you have two-digits
    if (hh < 10) {hh = "0"+hh;}
    if (mm < 10) {mm = "0"+mm;}
    if (ss < 10) {ss = "0"+ss;}
    // This formats your string to HH:MM:SS
    return hh+":"+mm+":"+ss;
}

function setAssignCommodityDependants() {
    unit = $('#unassignedCommodities').find(':selected').data('unit');
    if (unit)
        $('#assignCommodityUnit').text(unit);
    cumulative = $('#unassignedCommodities').find(':selected').data('cumulative');
    $('#cumulativeTrue').prop('checked', cumulative?'checked':'');
    $('#cumulativeFalse').prop('checked', !cumulative?'checked':'');
    if (!cumulative) {
        $('#startValue').val('0');
    }
}

// The function updates the values in simple submit form
// according to the submitCommodity and updateExisting value 
function updateSubmitForm() {
    updateCurrentCommodity ($('#submitCommodity').val(), true);
    var updateExisting = $('#updateExisting').is(':checked');
    var unit = $('#submitCommodity').find(':selected').data('unit');
    $('#submitUnit').text(' '+unit);
    var cumulative = $('#submitCommodity').find(':selected').data('cumulative');
    $('#submitCumulativeText').text(cumulative?'po števcu':'prirast od zadnjega vnosa');

    if (!updateExisting) {
        $('#submitDate').datepicker('setValue', new Date());
        $('#submitTime').timepicker('setTime', formatTime(new Date()));
        $('#submitValue').val('');
    } else {
        var commodityId = $('#submitCommodity').val();
        $.ajax({
            url: DATA_URL + 'entry/get_sequence',
            type: 'GET',
            data: {
                commodity: commodityId,
                deletable_only: true
            },
            xhrFields: { withCredentials: true },
            success: function(data, textStatus, xhr)
            {
                if (dataStatusIsBad (data.status, data.status_loc))
                    return; 
                if (data.data.length > 1) {
                    alert('Zadnje vnešeni odčitek je bil uvožen preko datoteke in ga ni moč popravljati, izklapljam stikalo "Popravi zadnjega".');
                    $('#updateExisting').prop('checked', false);
                    return;
                }
                if (data.data.length == 0) {
                    alert('Ni še vnešenih odčitkov, izklapljam stikalo "Popravi zadnjega".');
                    $('#updateExisting').prop('checked', false);
                    return;
                }
                $('#submitDate').datepicker('setValue', data.data[0][0]);
                $('#submitTime').timepicker('setTime', formatTime(new Date(data.data[0][0])));
                $('#submitValue').val(data.data[0][1]);
            },
            error: ajaxError
        });
    }
}

function logout() {
    $.ajax({
        url: DATA_URL + 'user/logout',
        type: 'POST',
        xhrFields: { withCredentials: true },
        success: function(data, textStatus, xhr)
        {
            top.location.href = HTML_URL + 'index.html';
        },
        error: ajaxError
    });
}

function requestDataEmail(cumulative) {
    $.ajax({
        url: DATA_URL + 'entry/send_by_email',
        type: 'GET',
        data: {
            commodity: $('#viewCommodity').val(),
            cumulative: (cumulative ? "true" : "false")
        },
        xhrFields: { withCredentials: true },
        success: function(data, textStatus, xhr)
        {
            if (dataStatusIsBad (data.status, data.status_loc))
                return; 
            alert('Podatki uspešno posredovani na e-naslov');
        },
        error: ajaxError
    });
}

function onBodyLoad() {
    initOCR();
    if (isMobileEnvironment()) {
        // modify the presentation styles for the mobiles
        var link = document.createElement("link");
        link.href = "css/mobile.css";
        link.type = "text/css";
        link.rel = "stylesheet";
        document.getElementsByTagName("head")[0].appendChild(link);
    }
    
}            
