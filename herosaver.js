function init() {
    (function(){

    RK.STLExporter = function () {};

    RK.STLExporter.prototype = {

        constructor: THREE.STLExporter,

        parse: ( function () {

            var vector = new THREE.Vector3();
            var normalMatrixWorld = new THREE.Matrix3();

            return function ( scenes ) {
                console.log(scenes);
                var output = '';
                output += 'solid exported\n';
                for(var scene_nr in scenes) {
                    scenes[scene_nr].traverse( function ( object ) {
                        if(object instanceof RK.Mesh){		    
                            // if object is hidden - exit
                            if(object.visible == false) return; 
                            var geometry = object.geometry;
                            var matrixWorld = object.matrixWorld;
                            var skeleton = object.skeleton;
                            var mesh = object;
			    console.log('Found Mesh' + mesh.name);
		            if(typeof onlyExportThisMesh !== 'undefined' && mesh.name != onlyExportThisMesh) {
				    console.log('Looking for :' + onlyExportThisMesh + ' therefore ignoring ' + mesh.name);
				    return;
			    }
			    console.log('exporting: ' + mesh.name);
                            if(geometry instanceof RK.BufferGeometry){
                                var oldgeometry = geometry.clone();
                                geometry = new RK.Geometry().fromBufferGeometry(geometry);
                                var skinIndex = oldgeometry.getAttribute('skinIndex0');
                                var skinWeight = oldgeometry.getAttribute('skinWeight0');
                                var morphTarget = oldgeometry.getAttribute('morphTarget0');
                                var mtcount = 0;
                                while(typeof morphTarget !== 'undefined') {
                                    mtcount++;
                                    morphTarget = oldgeometry.getAttribute('morphTarget' + mtcount);
                                }
                                if(typeof skinIndex !== 'undefined') {
                                    geometry.skinIndices = [];
                                    geometry.skinWeights = [];
                                    geometry.morphTargets = [];
                                    for(var j = 0; j < mtcount; j++) {
                                        geometry.morphTargets[j] = {};
                                        geometry.morphTargets[j].vertices = [];
                                    }
                                    for(var i = 0; i < geometry.vertices.length; i++) {
                                        geometry.skinIndices.push((new THREE.Vector4 ()).fromBufferAttribute(skinIndex,i));
                                        geometry.skinWeights.push((new THREE.Vector4 ()).fromBufferAttribute(skinWeight,i));
                                        for(var j = 0; j < mtcount; j++) {
                                            geometry.morphTargets[j].vertices.push((new THREE.Vector3 ()).fromBufferAttribute(oldgeometry.getAttribute('morphTarget' + j)));
                                        }
                                    }
                                }
                            }

                            if ( geometry instanceof RK.Geometry) {

                                var vertices = geometry.vertices;
                                var faces = geometry.faces;
                                normalMatrixWorld.getNormalMatrix( matrixWorld );

                                if(typeof faces != 'undefined'){
                                    for ( var i = 0, l = faces.length; i < l; i ++ ) {
                                        var face = faces[ i ];

                                        vector.copy( face.normal ).applyMatrix3( normalMatrixWorld ).normalize();

                                        output += '\tfacet normal ' + vector.x + ' ' + vector.y + ' ' + vector.z + '\n';
                                        output += '\t\touter loop\n';

                                        var indices = [ face.a, face.b, face.c ];

                                        for ( var j = 0; j < 3; j ++ ) {
                                            var vertexIndex = indices[ j ];
                                            if (typeof geometry.skinIndices !== 'undefined' && geometry.skinIndices.length == 0) {
                                                vector.copy( vertices[ vertexIndex ] ).applyMatrix4( matrixWorld );
                                                output += '\t\t\tvertex ' + vector.x + ' ' + vector.y + ' ' + vector.z + '\n';
                                            } else {
                                                vector.copy( vertices[ vertexIndex ] ); //.applyMatrix4( matrixWorld );

                                                // see https://github.com/mrdoob/three.js/issues/3187
                                                var boneIndices = [
                                                    geometry.skinIndices[vertexIndex].x,
                                                    geometry.skinIndices[vertexIndex].y,
                                                    geometry.skinIndices[vertexIndex].z,
                                                    geometry.skinIndices[vertexIndex].w
                                                ];

                                                var weights = [
                                                    geometry.skinWeights[vertexIndex].x,
                                                    geometry.skinWeights[vertexIndex].y,
                                                    geometry.skinWeights[vertexIndex].z,
                                                    geometry.skinWeights[vertexIndex].w
                                                ];

                                                var inverses = [
                                                    skeleton.boneInverses[ boneIndices[0] ],
                                                    skeleton.boneInverses[ boneIndices[1] ],
                                                    skeleton.boneInverses[ boneIndices[2] ],
                                                    skeleton.boneInverses[ boneIndices[3] ]
                                                ];

                                                var skinMatrices = [
                                                    skeleton.bones[ boneIndices[0] ].matrixWorld,
                                                    skeleton.bones[ boneIndices[1] ].matrixWorld,
                                                    skeleton.bones[ boneIndices[2] ].matrixWorld,
                                                    skeleton.bones[ boneIndices[3] ].matrixWorld
                                                ];

                                                //this checks to see if the mesh has any morphTargets - jc
                                                if (geometry.morphTargets !== 'undefined') {										
                                                    var morphMatricesX = [];
                                                    var morphMatricesY = [];
                                                    var morphMatricesZ = [];
                                                    var morphMatricesInfluence = [];

                                                    for (var mt = 0; mt < geometry.morphTargets.length; mt++) {
                                                        //collect the needed vertex info - jc
                                                        morphMatricesX[mt] = geometry.morphTargets[mt].vertices[vertexIndex].x;
                                                        morphMatricesY[mt] = geometry.morphTargets[mt].vertices[vertexIndex].y;
                                                        morphMatricesZ[mt] = geometry.morphTargets[mt].vertices[vertexIndex].z;
                                                        morphMatricesInfluence[mt] = mesh.morphTargetInfluences[mt];
                                                    }
                                                }

                                                var finalVector = new THREE.Vector4();

                                                if (mesh.geometry.morphTargets !== 'undefined') {

                                                    var morphVector = new THREE.Vector4(vector.x, vector.y, vector.z);

                                                    for (var mt = 0; mt < geometry.morphTargets.length; mt++) {
                                                        //not pretty, but it gets the job done - jc
                                                        morphVector.lerp(new THREE.Vector4(morphMatricesX[mt], morphMatricesY[mt], morphMatricesZ[mt], 1), morphMatricesInfluence[mt]);
                                                    }

                                                }

                                                for (var k = 0; k < 4; k++) {

                                                    var tempVector = new THREE.Vector4(vector.x, vector.y, vector.z);
                                                    tempVector.multiplyScalar(weights[k]);
                                                    //the inverse takes the vector into local bone space
                                                    tempVector.applyMatrix4(inverses[k])
                                                    //which is then transformed to the appropriate world space
                                                        .applyMatrix4(skinMatrices[k]);
                                                    finalVector.add(tempVector);

                                                }

                                                output += '\t\t\tvertex ' + finalVector.x + ' ' + finalVector.y + ' ' + finalVector.z + '\n';
                                            }
                                        }
                                        output += '\t\tendloop\n';
                                        output += '\tendfacet\n';
                                    }
                                }
                            }
                        }
                    } );
                }
                output += 'endsolid exported\n';

                return output;
            };
        }() )
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = RK.STLExporter
    } 
    else if ((typeof define !== "undefined" && define !== null) && (define.amd !== null)) {
        define([], function() {
            return saveAs;
        });
    }

    var model = CK.character;
	var characterArea_hook = ".content-side:first";
	var menu_style = {"margin-left": "20px", "font-size": "1.2em", "cursor" : "pointer" };
	
	var character_area, stl, stl_base, sjson, ljson, labeljson;
	
	stl = 				jQuery("<a />").css(menu_style).text("Export Figure");
	stl_base = 			jQuery("<a />").css(menu_style).css({"margin-left": "125px"}).text("Export Model (STL)");
	sjson = 			jQuery("<a />").css(menu_style).text("Export (JSON)");
	ljson  = 			jQuery("<input/>").attr({"type": "file", "id": "ljson"}).css({"display":"none"}).text("Import (JSON)");
	labeljson  = 		jQuery("<label/>").attr({"for": "ljson"}).css(menu_style).text("Import (JSON)");
    enlarge = 			jQuery("<a />").css(menu_style).text("Enlarge");
	reset_scale = 			jQuery("<a />").css(menu_style).text("Reset Scale");
	
	character_area = 	jQuery(characterArea_hook);
	
    //character_area.append(stl);
    character_area.append(stl_base);
    character_area.append(sjson);
    character_area.append(ljson);
    character_area.append(labeljson);
    character_area.append(enlarge);
    character_area.append(reset_scale);
    character_area.css("right", 0);

    /*stl.click(function(e) {
        e.preventDefault(); 
        var exporter = new RK.STLExporter();    
        var objs = CK.character.children;    
        var character = objs[0];
        var figure = [];
        var max_objs = 0;
        var i;
        for(i in objs) { // find character
            if (objs[i].children.length > objs[max_objs].children.length) {
                console.log("Id " + max_objs + " is not the character");
                character = objs[i];
                max_objs = i;
            }        
        }
        if(character.children.length > 9) { // There is an option to hide the character. Since I do not know where this option is saved
            // we use the following heuristic: If there is no object with 10 or more children, the character
            // must be hidden...
            console.log("Found Character, id=" + max_objs);
            console.log(character);
            figure.push(character);
        }
        if(CK.data.parts.mount !== undefined) {
            console.log("Exporting Mount");
            var mount = undefined;
            for(i in objs) { // find mount
                var j;
                for(j in objs[i].children) {
                    if(objs[i].children[j].name == "mount" && objs[i].children.length < 10) {
                        console.log("Found mount, id=" + i + "," + j)
                        mount = objs[i];
                    }
                }
            }
            console.log(mount);
            figure.push(mount);
            console.log(figure);
        }
        console.log(figure);
        var stlString = exporter.parse(figure)
        var name = get_name();
        download(stlString, name + '.stl', 'application/sla');
    });*/
    
    stl_base.click(function(e) {
        e.preventDefault(); 
        download_stl(model);
    });

    enlarge.click(function(e) {
        e.preventDefault(); 
        set_object_props(model,[10, 10, 10], [Math.PI / 2, 0, 0]);
    });

    reset_scale.click(function(e) {
        e.preventDefault(); 
        set_object_props(model,[1, 1, 1], [0, 0, 0]);
    });

    sjson.click(function(e) {
        e.preventDefault();
        var char_json = JSON.stringify(CK.data);
        var name = get_name();
        download(char_json, name + ".json", "text/plain");
    });

    ljson.on('change', function(e) {
        e.preventDefault();
        var file = e.target.files[0];
        var reader = new FileReader();
        reader.onload = (function(theFile) {
            return function(e) {
                e.preventDefault();
                CK.change(JSON.parse(e.target.result));
            };
        })(file);
        reader.readAsText(file);
    });
})()};

function inject_script(url, callback) {
  var head = document.getElementsByTagName("head")[0];
  var script = document.createElement("script");
  script.src = url; 
  script.onload = function(e) { 
      callback() };
  head.appendChild(script);
}

inject_script("//code.jquery.com/jquery-3.3.1.js", function () {
    inject_script("//cdnjs.cloudflare.com/ajax/libs/three.js/108/three.js", function () { init() })
});

function download_stl(object){
    var exporter = new RK.STLExporter();   
    var stlString = exporter.parse([object])
    var name = get_name();
    download(stlString, name + '.stl', 'application/sla');
}

function set_object_props(object,scale,rot){
    object.scale.set( ...scale );
    object.rotation.set( ...rot );
    object.refresh();
}

function get_name() {
  var timestamp = new Date().getUTCMilliseconds();
  var uqID = timestamp.toString(36);
  var name = "Character " + uqID; 
  try {
    var getName = CK.character.data.meta.character_name
    name = getName === "" ? name : getName;
  } catch (e) {
    if (e instanceof ReferenceError) {
        console.log("Name of character data location has changed");
        console.log(e);
    } else {
        console.log("Other Error");
        console.log(e);
    }
  }
  return name;
}
