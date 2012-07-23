			var map, drawControls, selectControl, selectedFeature;
            var untiled;
            var tiled;
            var pureCoverage = false;
            
            var vectors,control,navegador;
			var markers;
	    	var popup, click;
            
            // pink tile avoidance
            OpenLayers.IMAGE_RELOAD_ATTEMPTS = 5;
            // make OL compute scale according to WMS spec
            OpenLayers.DOTS_PER_INCH = 25.4 / 0.28;
            
            var capitais = new OpenLayers.Layer.WMS( "OpenLayers WMS",
             "http://localhost:8080/geoserver/topp/wms", {layers: 'topp:BR_Capitais', transparent: true},
             {isBaseLayer : false });	        
        
            function init(){
                // if this is just a coverage or a group of them, disable a few items,
                // and default to jpeg format
                format = 'image/png';
            
                var bounds = new OpenLayers.Bounds(
                    -124.73142200000001, 24.955967,
                    -66.969849, 49.371735
                );
                var options = {
                    controls: [],
                    maxExtent: bounds,
                    maxResolution: 0.22563114453125,
                    projection: "EPSG:4326",
                    units: 'degrees'
                };
                map = new OpenLayers.Map('map', options);
                			
            
                // setup tiled layer
                tiled = new OpenLayers.Layer.WMS(
                    "Capitais", "http://localhost:8080/geoserver/topp/wms",
                    {
                        LAYERS: 'topp:BR_Capitais',
                        STYLES: '',
                        format: format,
                        tiled: true,
                        transparent: true,
                        tilesOrigin : map.maxExtent.left + ',' + map.maxExtent.bottom
                    },
                    {
                        buffer: 0,
                        displayOutsideMaxExtent: true,
                        isBaseLayer: false,
                        yx : {'EPSG:4326' : true}
                    } 
                );
            
                // setup single tiled layer
                untiled = new OpenLayers.Layer.WMS(
                    "Estados", "http://localhost:8080/geoserver/topp/wms",
                    {
                        LAYERS: 'topp:states',
                        STYLES: '',
                        transparent: true,
                        format: format
                    },
                    {
                       singleTile: true, 
                       ratio: 1, 
                       isBaseLayer: false,
                       yx : {'EPSG:4326' : true}
                    } 
                );
                
                vectors = new OpenLayers.Layer.Vector("Vector Layer");
                markers = new OpenLayers.Layer.Markers("markers");
                map.addLayer(markers);
                
                var osm = new OpenLayers.Layer.OSM();
                map.addLayers([osm, untiled, tiled]);
                
                // build up all controls
                map.addControl(new OpenLayers.Control.PanZoomBar({position: new OpenLayers.Pixel(2, 10) }));
                map.addControl(new OpenLayers.Control.Navigation());
                map.addControl(new OpenLayers.Control.Scale($('scale')));
                map.addControl(new OpenLayers.Control.ScaleLine());
                map.addControl(new OpenLayers.Control.OverviewMap());
                map.addControl(new OpenLayers.Control.LayerSwitcher());
                map.addControl(new OpenLayers.Control.MousePosition({element: $('location')}));
                map.zoomToExtent(bounds);
                
                
                
                // wire up the option button
                var options = document.getElementById("options");
                options.onclick = toggleControlPanel;
                
                // support GetFeatureInfo
                map.events.register('click', map, function (e) {
                    document.getElementById('nodelist').innerHTML = "Loading... please wait...";
                    var params = {
                        REQUEST: "GetFeatureInfo",
                        EXCEPTIONS: "application/vnd.ogc.se_xml",
                        BBOX: map.getExtent().toBBOX(),
                        SERVICE: "WMS",
                        INFO_FORMAT: 'text/html',
                        QUERY_LAYERS: map.layers[0].params.LAYERS,
                        FEATURE_COUNT: 50,
                        Layers: 'topp:states',
                        WIDTH: map.size.w,
                        HEIGHT: map.size.h,
                        format: format,
                        styles: map.layers[0].params.STYLES,
                        srs: map.layers[0].params.SRS};
                    
                    // handle the wms 1.3 vs wms 1.1 madness
                    if(map.layers[0].params.VERSION == "1.3.0") {
                        params.version = "1.3.0";
                        params.j = parseInt(e.xy.x);
                        params.i = parseInt(e.xy.y);
                    } else {
                        params.version = "1.1.1";
                        params.x = parseInt(e.xy.x);
                        params.y = parseInt(e.xy.y);
                    }
                        
                    // merge filters
                    if(map.layers[0].params.CQL_FILTER != null) {
                        params.cql_filter = map.layers[0].params.CQL_FILTER;
                    } 
                    if(map.layers[0].params.FILTER != null) {
                        params.filter = map.layers[0].params.FILTER;
                    }
                    if(map.layers[0].params.FEATUREID) {
                        params.featureid = map.layers[0].params.FEATUREID;
                    }
                    OpenLayers.loadURL("http://localhost:8080/geoserver/topp/wms", params, this, setHTML, setHTML);
                    OpenLayers.Event.stop(e);
                });
            }
            
            // sets the HTML provided into the nodelist element
            function setHTML(response){
                document.getElementById('nodelist').innerHTML = response.responseText;
            };
            
            // shows/hide the control panel
            function toggleControlPanel(event){
                var toolbar = document.getElementById("toolbar");
                if (toolbar.style.display == "none") {
                    toolbar.style.display = "block";
                }
                else {
                    toolbar.style.display = "none";
                }
                event.stopPropagation();
                map.updateSize()
            }
            
            // Tiling mode, can be 'tiled' or 'untiled'
            function setTileMode(tilingMode){
                if (tilingMode == 'tiled') {
                    untiled.setVisibility(false);
                    tiled.setVisibility(true);
                    map.setBaseLayer(tiled);
                }
                else {
                    untiled.setVisibility(true);
                    tiled.setVisibility(false);
                    map.setBaseLayer(untiled);
                }
            }
            
            // Transition effect, can be null or 'resize'
            function setTransitionMode(transitionEffect){
                if (transitionEffect === 'resize') {
                    tiled.transitionEffect = transitionEffect;
                    untiled.transitionEffect = transitionEffect;
                }
                else {
                    tiled.transitionEffect = null;
                    untiled.transitionEffect = null;
                }
            }
            
            // changes the current tile format
            function setImageFormat(mime){
                // we may be switching format on setup
                if(tiled == null)
                  return;
                  
                tiled.mergeNewParams({
                    format: mime
                });
                untiled.mergeNewParams({
                    format: mime
                });
                /*
                var paletteSelector = document.getElementById('paletteSelector')
                if (mime == 'image/jpeg') {
                    paletteSelector.selectedIndex = 0;
                    setPalette('');
                    paletteSelector.disabled = true;
                }
                else {
                    paletteSelector.disabled = false;
                }
                */
            }
            
            // sets the chosen style
            function setStyle(style){
                // we may be switching style on setup
                if(tiled == null)
                  return;
                  
                tiled.mergeNewParams({
                    styles: style
                });
                untiled.mergeNewParams({
                    styles: style
                });
            }
            
            // sets the chosen WMS version
            function setWMSVersion(wmsVersion){
                // we may be switching style on setup
                if(wmsVersion == null)
                  return;
                  
                if(wmsVersion == "1.3.0") {
                   origin = map.maxExtent.bottom + ',' + map.maxExtent.left;
                } else {
                   origin = map.maxExtent.left + ',' + map.maxExtent.bottom;
                }
                  
                tiled.mergeNewParams({
                    version: wmsVersion,
                    tilesOrigin : origin
                });
                untiled.mergeNewParams({
                    version: wmsVersion
                });
            }
            
            function setAntialiasMode(mode){
                tiled.mergeNewParams({
                    format_options: 'antialias:' + mode
                });
                untiled.mergeNewParams({
                    format_options: 'antialias:' + mode
                });
            }
            
            function setPalette(mode){
                if (mode == '') {
                    tiled.mergeNewParams({
                        palette: null
                    });
                    untiled.mergeNewParams({
                        palette: null
                    });
                }
                else {
                    tiled.mergeNewParams({
                        palette: mode
                    });
                    untiled.mergeNewParams({
                        palette: mode
                    });
                }
            }
            
            function setWidth(size){
                var mapDiv = document.getElementById('map');
                var wrapper = document.getElementById('wrapper');
                
                if (size == "auto") {
                    // reset back to the default value
                    mapDiv.style.width = null;
                    wrapper.style.width = null;
                }
                else {
                    mapDiv.style.width = size + "px";
                    wrapper.style.width = size + "px";
                }
                // notify OL that we changed the size of the map div
                map.updateSize();
            }
            
            function setHeight(size){
                var mapDiv = document.getElementById('map');
                
                if (size == "auto") {
                    // reset back to the default value
                    mapDiv.style.height = null;
                }
                else {
                    mapDiv.style.height = size + "px";
                }
                // notify OL that we changed the size of the map div
                map.updateSize();
            }
            
            function updateFilter(){
                if(pureCoverage)
                  return;
            
                var filterType = document.getElementById('filterType').value;
                var filter = document.getElementById('filter').value;
                
                // by default, reset all filters
                var filterParams = {
                    filter: null,
                    cql_filter: null,
                    featureId: null
                };
                if (OpenLayers.String.trim(filter) != "") {
                    if (filterType == "cql") 
                        filterParams["cql_filter"] = filter;
                    if (filterType == "ogc") 
                        filterParams["filter"] = filter;
                    if (filterType == "fid") 
                        filterParams["featureId"] = filter;
                }
                // merge the new filter definitions
                mergeNewParams(filterParams);
            }
            
            function atualizarFilter(tipo, filtro){
                if(pureCoverage)
                  return;
            
                var filterType = tipo;
                var filter = filtro;
                
                // by default, reset all filters
                var filterParams = {
                    filter: null,
                    cql_filter: null,
                    featureId: null
                };
                if (OpenLayers.String.trim(filter) != "") {
                    if (filterType == "cql") 
                        filterParams["cql_filter"] = filter;
                    if (filterType == "ogc") 
                        filterParams["filter"] = filter;
                    if (filterType == "fid") 
                        filterParams["featureId"] = filter;
                }
                // merge the new filter definitions
                mergeNewParams(filterParams);
            }
            
            function resetFilter() {
                if(pureCoverage)
                  return;
            
                document.getElementById('filter').value = "";
                updateFilter();
            }
            
            function mergeNewParams(params){
//                tiled.mergeNewParams(params);
                untiled.mergeNewParams(params);
            }
            
            
            
            //Métodos Antigos
            //----------------------------------
            
            OpenLayers.Control.Click = OpenLayers.Class(OpenLayers.Control, {                
                	defaultHandlerOptions: 
			{
                    		'single': true,
                    		'double': false,
                    		'pixelTolerance': 0,
                    		'stopSingle': false,
                    		'stopDouble': false
                	},
	 
         initialize: function(options){
         	this.handlerOptions = OpenLayers.Util.extend({}, this.defaultHandlerOptions);
            OpenLayers.Control.prototype.initialize.apply(this, arguments); 
            this.handler = new OpenLayers.Handler.Click(this, {'click': this.trigger }, 
			this.handlerOptions);
            },
               	trigger: function(e) 
			{
            	var lonlat = map.getLonLatFromViewPortPx(e.xy);
				popup = new OpenLayers.Popup("Posição do Click",
                   			new OpenLayers.LonLat(lonlat.lon, lonlat.lat),
                   			new OpenLayers.Size(200,150),
                   			"<p align='left'><font face='verdana' size='2'><b>Id: </b></font></p>" + "01"  + " N  <br/><p align='left'><font face='verdana' size='2'><b>Latitude: </b></font></p>" + lonlat.lat + " N  <br/><p align='left'><font face='verdana' size='2'><b>Longitude: </b></font></p>" + lonlat.lon + " E",
                   			true);
				popup.setBorder("1px solid");   
				
				map.addPopup(popup);
                    		
                	} 
            });
            
            function toggleControl(element) {
				desativarInfo();
                for(key in controls) {
                    control = controls[key];
                    if(element == key) {
                        control.activate();
                    } else {
                        control.deactivate();
                    }
                }
         	}
			
			function removerNavegador(){
				map.removeControl(navegador);				
			}
			
			function zoomInicial(){
				 map.setCenter(new OpenLayers.LonLat(-49.83922,-23.05626), 2); 
			}
			
			function addLayerSede(){               
			    map.addLayers([sedes]);
			}
									
			function removerLayerSede(){
				map.removeLayer(sedes);
			}
			
			function addLayerMunicipio(){               
			    map.addLayers([municipios]);
			}
			
			function removerLayerMunicipio(){
				map.removeLayer(municipios);
			}
			
			function addLayerRodoviasEmPavimentacao(){               
			    map.addLayers([rodovias_em_pavimentacao]);
			}
			
			function removerLayerRodoviasEmPavimentacao(){
				map.removeLayer(rodovias_em_pavimentacao);
			}
			
			function addLayerRodoviasPavimentadas(){               
			    map.addLayers([rodovias_pavimentadas]);
			}
			
			function removerLayerRodoviasPavimentadas(){
				map.removeLayer(rodovias_pavimentadas);
			}
			
			function addLayerRodoviasNaoPavimentadas(){
				map.addLayers([rodovias_nao_pavimentadas]);
			}
			
			function removerLayerRodoviasNaoPavimentadas(){
				map.removeLayer(rodovias_nao_pavimentadas);
			}
			
			
			function ativarNavegador(){
				toggleControl('none');				
			}
									
			function ativarInfo(){
				toggleControl('none');				
				removerNavegador();
				click.activate(); 
			}
			
			function desativarInfo(){
				click.deactivate();
			}
			
			function removerMarkers(){
				map.removeLayer(markers);
				markers = new OpenLayers.Layer.Markers("markers");
                map.addLayer(markers);							
			}
		
			function zoomOut(){
				map.zoomOut();				
			}
			
			function zoomIn(){
				map.zoomIn();				
			}
            
            