**
* @author Mark Kellogg - http://www.github.com/mkkellogg
*/

//=======================================
// Trail Renderer
//=======================================

THREE.TrailRenderer = THREE.TrailRenderer || {};

THREE.TrailRenderer.Renderer = function( length, scene, material, localHeadWidth, localHeadGeometry, targetObject ) {

	THREE.Object3D.call( this );

	this.localHeadWidth = localHeadWidth;
	this.localHeadGeometry = localHeadGeometry;
	this.targetObject = targetObject;
	this.length = length;
	this.scene = scene;
	this.material = material;

	this.geometry = null;
	this.mesh = null;
	this.nodeCenters = null;
	this.nodeIDs = null;
	this.lastPosition = null;
	this.currentLength = 0;

}

THREE.TrailRenderer.Renderer.prototype = Object.create( THREE.Object3D.prototype );
THREE.TrailRenderer.Renderer.constructor = THREE.TrailRenderer.Renderer;

THREE.TrailRenderer.Renderer.Shader.VertexVars = [

	"attribute int nodeID;",
	"attribute vec3 edgePosition;",
	"attribute vec3 position;",
	"attribute vec2 uv;",

	"uniform int minID;",
	"uniform int maxID;",
	"uniform int trailLength;",

	"uniform vec4 headColor;",
	"uniform vec4 tailColor;",

	"varying vec2 vUV;",
	"varying vec4 vColor;",

].join( "\n" );

THREE.TrailRenderer.Renderer.Shader.FragmentVars = [

	"varying vec2 vUV;",
	"varying vec4 vColor;",

	"uniform sampler2D texture;",

].join( "\n" );

THREE.TrailRenderer.Renderer.Shader.VertexShader = [

	THREE.TrailRenderer.Renderer.Shader.VertexVars,

	"void main() { ",

		"vUV = uv; ",
		"float fraction = nodeID / ( maxID - minID );",
		"vColor = ( 1 - fraction ) * headColor + fraction * tailColor;",
		"vec4 realPosition = ( 1 - fraction ) * position.xyz + fraction * edgePosition.xyz; ", 
		"gl_Position = projectionMatrix * viewMatrix * modelMatrix * realPosition;",

	"}"

].join( "\n" );

THREE.TrailRenderer.Renderer.Shader.FragmentShader = [

	THREE.TrailRenderer.Renderer.Shader.FragmentVars,

	"void main() { ",

	    "vec4 textureColor = texture2D( texture, vUV );",
		"gl_FragColor = vColor * textureColor;",

	"}"

].join( "\n" );

THREE.TrailRenderer.Renderer.createMaterial = function( vertexShader, fragmentShader, customUniforms ) {

	customUniforms = customUniforms || {};

	customUniforms.trailLength = { type: "f", value: null };
	customUniforms.minID = { type: "i", value: null };
	customUniforms.maxID = { type: "i", value: null };

	customUniforms.headColor = { type: "fv", value: null };
	customUniforms.tailColor = { type: "fv", value: null };

	vertexShader = vertexShader || THREE.TrailRenderer.Renderer.Shader.VertexShader;
	fragmentShader = fragmentShader || THREE.TrailRenderer.Renderer.Shader.FragmentShader;

	return new THREE.ShaderMaterial(
	{
		uniforms: customUniforms,
		vertexShader: vertexShader,
		fragmentShader: fragmentShader,

		transparent: true,
		alphaTest: 0.5,

		blending: THREE.NormalBlending,

		depthTest: true,
		depthWrite: false
	} );

}

THREE.TrailRenderer.Renderer.prototype.initialize = function() {

	this.nodeIDs = [];

	this.initializeGeometry();
	this.initializeMesh();

	this.reset( new THREE.Vector3() );

}

THREE.Particles.ParticleSystem.prototype.initializeGeometry = function() {

	this.vertexCount = this.length * 6;

	var geometry = new THREE.BufferGeometry();

	var nodeIDs = new Uint32Array( this.vertexCount );
	var positions = new Float32Array( this.vertexCount * 3 );
	var edgePositions = new Float32Array( this.vertexCount * 3 );
	var uvs = new Float32Array( this.vertexCount * 2 );

	var nodeIDAttribute = new THREE.BufferAttribute( nodeIDs, 1 );
	nodeIDAttribute.setDynamic( true );
	geometry.addAttribute( 'nodeID', nodeIDAttribute );

	var positionAttribute = new THREE.BufferAttribute( positions, 3 );
	positionAttribute.setDynamic( true );
	geometry.addAttribute( 'position', positionAttribute );

	var edgePositionAttribute = new THREE.BufferAttribute( edgePositions, 3 );
	edgePositionAttribute.setDynamic( true );
	geometry.addAttribute( 'edgePosition', edgePositionAttribute );

	var uvAttribute = new THREE.BufferAttribute( uvs, 2 );
	uvAttribute.setDynamic( true );
	geometry.addAttribute( 'uv', uvAttribute );

	this.geometry = geometry;

}

THREE.TrailRenderer.Renderer.prototype.initializeMesh = function() {

	this.destroyMesh();

	this.mesh = new THREE.Mesh( this.geometry, this.material );
	this.mesh.dynamic = true;
	this.mesh.matrixAutoUpdate = false;

}

THREE.TrailRenderer.Renderer.prototype.destroyMesh = function() {

	if ( this.trailMesh ) {

		this.scene.remove( this.trailMesh );
		this.trailMesh = null;

	}

}

THREE.TrailRenderer.Renderer.prototype.reset = function( position ) {

	this.currentLength = 0;
	this.lastPosition = null;
	this.updateGeometry( position );

}

THREE.TrailRenderer.Renderer.prototype.update = function( position ) {

	this.updateGeometry( position );

}

THREE.TrailRenderer.Renderer.prototype.updateGeometry = function( position ){ 




}

THREE.TrailRenderer.Node = function() {

	this.position = new THREE.Vector3();
	this.direction = new THREE.Vector3();

}


