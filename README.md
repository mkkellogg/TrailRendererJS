# Three.js Trail Renderer

Basic trail renderer for Three.js. This library allows for the straight-forward attachment of motion trails to any 3D object. The programmer simply has to specify the shape of the trail and its target (the target must be a Three.js Object3D instance). The update of the trail is handled automatically by the library. 

The shape of the trail is specified by supplying a list of 3D points. These points make up the local-space head of the trail. During the update phase for the trail, a new instance of the head is created by transforming the local points into world-space using the target Object3D instance's local-to-world transformation matrix. These points are then connected to the existing head of the trail to extend the trail's geometry. 

The trail renderer currently supports both textured and non-textured trails. Non-textured trails work well with many trail shapes in both translucent and opaque modes. Textured trails work well with many shapes as long as the trail is opaque; if the trail is not opaque, flat shapes work best. 

Demo of the effect can be seen [here](http://projects.markkellogg.org/threejs/demo_trail_renderer.php)

The following code shows how to attach a trail renderer in a scene named 'scene' to an existing Object3D instance named 'trailTarget'.

```javascript
// specify points to create planar trail-head geometry
const trailHeadGeometry = [];
trailHeadGeometry.push( 
  new THREE.Vector3( -10.0, 0.0, 0.0 ), 
  new THREE.Vector3( 0.0, 0.0, 0.0 ), 
  new THREE.Vector3( 10.0, 0.0, 0.0 ) 
);

// create the trail renderer object
const trail = new TrailRenderer( scene, false );

// set how often a new trail node will be added and existing nodes will be updated
trail.setAdvanceFrequency(30);

// create material for the trail renderer
const trailMaterial = TrailRenderer.createBaseMaterial();	

// specify length of trail
const trailLength = 150;

// initialize the trail
trail.initialize( trailMaterial, trailLength, false, 0, trailHeadGeometry, trailTarget );

// activate the trail
trail.activate();

function animate() {
    requestAnimationFrame( animate );
    trail.update();
    render();
 
}

```