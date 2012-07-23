/* Copyright (c) 2006-2008 MetaCarta, Inc., published under the Clear BSD
 * license.  See http://svn.openlayers.org/trunk/openlayers/license.txt for the
 * full text of the license. */

/**
 * @requires OpenLayers/Format/XML.js
 */

/**
 * Class: OpenLayers.Format.WMSGetFeatureInfo
 * Class to read GetFeatureInfo responses from Web Mapping Services
 *
 * Inherits from:
 *  - <OpenLayers.Format.XML>
 */
OpenLayers.Format.WMSGetFeatureInfo = OpenLayers.Class(OpenLayers.Format.XML, {

    /**
     * APIProperty: layerIdentifier
     * {String} All xml nodes containing this search criteria will populate an
     *     internal array of layer nodes.
     */ 
    layerIdentifier: '_layer',

    /**
     * APIProperty: featureIdentifier
     * {String} All xml nodes containing this search criteria will populate an 
     *     internal array of feature nodes for each layer node found.
     */
    featureIdentifier: '_feature',

    /**
     * Property: regExes
     * Compiled regular expressions for manipulating strings.
     */
    regExes: {
        trimSpace: (/^\s*|\s*$/g),
        removeSpace: (/\s*/g),
        splitSpace: (/\s+/),
        trimComma: (/\s*,\s*/g)
    },

    /**
     * Property: gmlFormat
     * {<OpenLayers.Format.GML>} internal GML format for parsing geometries
     *     in msGMLOutput
     */
    gmlFormat: null,

    /**
     * Constructor: OpenLayers.Format.WMSGetFeatureInfo
     * Create a new parser for WMS GetFeatureInfo responses
     *
     * Parameters:
     * options - {Object} An optional object whose properties will be set on
     *     this instance.
     */
    initialize: function(options) {
        OpenLayers.Format.XML.prototype.initialize.apply(this, arguments);
        OpenLayers.Util.extend(this, options);
        this.options = options;
    },

    /**
     * APIMethod: read
     * Read WMS GetFeatureInfo data from a string, and return an array of features
     *
     * Parameters:
     * data - {String} or {DOMElement} data to read/parse.
     *
     * Returns:
     * {Array(<OpenLayers.Feature.Vector>)} An array of features.
     */
    read: function(data) {
        var result;
        if(typeof data == "string") {
            data = OpenLayers.Format.XML.prototype.read.apply(this, [data]);
        }
        var root = data.documentElement;
        if(root) {
            var scope = this;
            var read = this["read_" + root.nodeName];
            if(read) {
                result = read.call(this, root);
            } else {
                // fall-back to GML since this is a common output format for WMS
                // GetFeatureInfo responses
                result = new OpenLayers.Format.GML((this.options ? this.options : {})).read(data);
            }
        } else {
            result = data;
        }
        return result;
    },
    
    
    /**
     * Method: read_msGMLOutput
     * Parse msGMLOutput nodes.
     *
     * Parameters:
     * data - {DOMElement}
     *
     * Returns:
     * {Array}
     */
    read_msGMLOutput: function(data) {
        var response = [];
        var layerNodes = this.getSiblingNodesByTagCriteria(data,
            this.layerIdentifier);
        if (layerNodes) {
            for (var i=0, len=layerNodes.length; i<len; ++i) {
                var node = layerNodes[i];
                var layerName = node.nodeName;
                if (node.prefix) {
                    layerName = layerName.split(':')[1];
                }
                var layerName = layerName.replace(this.layerIdentifier, '');
                var featureNodes = this.getSiblingNodesByTagCriteria(node, 
                    this.featureIdentifier);
                if (featureNodes) {
                    for (var j = 0; j < featureNodes.length; j++) {
                        var featureNode = featureNodes[j];
                        var geom = this.parseGeometry(featureNode);
                        var attributes = this.parseAttributes(featureNode);
                        var feature = new OpenLayers.Feature.Vector(geom, 
                            attributes, null);
                        feature.type = layerName;
                        response.push(feature);
                    }
                }
            }
        }
        return response;
    },
    
    /**
     * Method: read_FeatureInfoResponse
     * Parse FeatureInfoResponse nodes.
     *
     * Parameters:
     * data - {DOMElement}
     *
     * Returns:
     * {Array}
     */
    read_FeatureInfoResponse: function(data) {
        var response = [];
        var featureNodes = this.getElementsByTagNameNS(data, '*',
            'FIELDS');

        for(var i=0, len=featureNodes.length;i<len;i++) {
            var featureNode = featureNodes[i];
            var geom = null;

            var attributes = {};
            for(var j=0, jlen=featureNode.attributes.length; j<jlen; j++) {
                var attribute = featureNode.attributes[j];
                attributes[attribute.nodeName] = attribute.nodeValue;
            }

            response.push(
                new OpenLayers.Feature.Vector(geom, attributes, null)
            );
        }
        return response;
    },

    /**
     * Method: getSiblingNodesByTagCriteria
     * Recursively searches passed xml node and all it's descendant levels for 
     *     nodes whose tagName contains the passed search string. This returns an 
     *     array of all sibling nodes which match the criteria from the highest 
     *     hierarchial level from which a match is found.
     * 
     * Parameters:
     * node - {DOMElement} An xml node
     * criteria - {String} Search string which will match some part of a tagName 
     *                                       
     * Returns:
     * Array({DOMElement)) An array of sibling xml nodes
     */                
    getSiblingNodesByTagCriteria: function(node, criteria){
        var nodes = [];
        var children, tagName, n, matchNodes, child;
        if (node && node.hasChildNodes()) {
            children = node.childNodes;
            n = children.length;

            for(var k=0; k<n; k++){
                child = children[k];
                while (child && child.nodeType != 1) {
                    child = child.nextSibling;
                    k++;
                }
                tagName = (child ? child.nodeName : '');
                if (tagName.length > 0 && tagName.indexOf(criteria) > -1) {
                    nodes.push(child);
                } else {
                    matchNodes = this.getSiblingNodesByTagCriteria(
                        child, criteria);

                    if(matchNodes.length > 0){
                        (nodes.length == 0) ? 
                            nodes = matchNodes : nodes.push(matchNodes);
                    }
                }
            }

        }
        return nodes;
    },

    /**
     * Method: parseAttributes
     *
     * Parameters:
     * node - {<DOMElement>}
     *
     * Returns:
     * {Object} An attributes object.
     * 
     * Notes:
     * Assumes that attributes are direct child xml nodes of the passed node
     * and contain only a single text node. 
     */    
    parseAttributes: function(node){
        var attributes = {};
        if (node.nodeType == 1) {
            var children = node.childNodes;
            n = children.length;
            for (var i = 0; i < n; ++i) {
                var child = children[i];
                if (child.nodeType == 1) {
                    var grandchildren = child.childNodes;
                    if (grandchildren.length == 1) {
                        var grandchild = grandchildren[0];
                        if (grandchild.nodeType == 3 ||
                            grandchild.nodeType == 4) {
                            var name = (child.prefix) ? 
                                child.nodeName.split(":")[1] : child.nodeName;
                            var value = grandchild.nodeValue.replace(
                                this.regExes.trimSpace, "");
                            attributes[name] = value;
                        }
                    }
                }
            }
        }
        return attributes;
    },

    /**
     * Method: parseGeometry
     * Parse the geometry out of the node using Format.GML
     *
     * Parameters:
     * node - {<DOMElement>}
     *
     * Returns:
     * {<OpenLayers.Geometry>} the geometry object
    */
    parseGeometry: function(node) {
        // we need to use the old Format.GML parser since we do not know the 
        // geometry name
        if (!this.gmlFormat) {
            this.gmlFormat = new OpenLayers.Format.GML();
        }
        var feature = this.gmlFormat.parseFeature(node);
        var geometry = null;
        if (feature && feature.geometry) {
            geometry = feature.geometry.clone();
            feature.destroy();
        }
        return geometry;
    },

    CLASS_NAME: "OpenLayers.Format.WMSGetFeatureInfo"
    
});
