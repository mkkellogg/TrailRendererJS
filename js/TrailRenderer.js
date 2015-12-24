**
* @author Mark Kellogg - http://www.github.com/mkkellogg
*/

//=======================================
// Trail Renderer
//=======================================

THREE.TrailRenderer = THREE.TrailRenderer || {};

THREE.TrailRenderer.Renderer = function( localWidth, localGeometry, targetObject ) {

	THREE.Object3D.call( this );

	this.localWidth = localWidth;
	this.localGeometry = localGeometry;
	this.targetObject = targetObject;

}

THREE.TrailRenderer.Renderer.prototype = Object.create( THREE.Object3D.prototype );
THREE.TrailRenderer.Renderer.constructor = THREE.TrailRenderer.Renderer;

THREE.TrailRenderer.Renderer.prototype.reset = function( startPosition ) {

	

}

THREE.TrailRenderer.Renderer.prototype.update = function( currentPosition ) {

	

}


THREE.TrailRenderer.Node = function() {

	this.position = new THREE.Vector3();
	this.direction = new THREE.Vector3();

}


