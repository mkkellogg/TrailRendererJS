/**
* @author Mark Kellogg - http://www.github.com/mkkellogg
*/

//=======================================
// Trail Renderer
//=======================================

THREE.TrailRenderer = THREE.TrailRenderer || {};

THREE.TrailRenderer.MaxHeadVertices = 128;
THREE.TrailRenderer.LocalOrientationTangent = new THREE.Vector3( 1, 0, 0 );
THREE.TrailRenderer.LocalHeadOrigin = new THREE.Vector3( 0, 0, 0 );

THREE.TrailRenderer.Renderer = function( length, scene, material, localHeadWidth, localHeadGeometry, targetObject ) {

	THREE.Object3D.call( this );

	this.active = false;

	this.targetObject = targetObject;
	this.length = ( length > 0 ) ? length + 1 : 0;
	this.scene = scene;
	this.material = material;

	this.geometry = null;
	this.mesh = null;
	this.nodeCenters = null;
	this.nodeIDs = null;

	this.currentLength = 0;
	this.currentEnd = 0;

	this.currentNodeID = 0;

	this.localHeadGeometry = [];

	if ( ! localHeadGeometry ) {

		var halfWidth = localHeadWidth || 1.0;
		halfWidth = halfWidth / 2.0;

		this.localHeadGeometry.push( new THREE.Vector3( -halfWidth, 0, 0 ) );
		this.localHeadGeometry.push( new THREE.Vector3( halfWidth, 0, 0 ) );

		this.VerticesPerNode = 2;

	} else {

		this.VerticesPerNode = 0;
		for ( var i = 0; i < localHeadGeometry.length && i < THREE.TrailRenderer.MaxHeadVertices; i ++ ) {

			var vertex = localHeadGeometry[ i ];

			if ( vertex && vertex instanceof THREE.Vector3 ) {

				var vertexCopy = new THREE.Vector3();

				vertexCopy.copy( vertex );

				this.localHeadGeometry.push( vertexCopy );
				this.VerticesPerNode ++;

			}

		}

	}

	this.FacesPerNode = ( this.VerticesPerNode - 1 ) * 2;
	this.FaceIndicesPerNode = this.FacesPerNode * 3;

}

THREE.TrailRenderer.Renderer.prototype = Object.create( THREE.Object3D.prototype );
THREE.TrailRenderer.Renderer.constructor = THREE.TrailRenderer.Renderer;

THREE.TrailRenderer.Renderer.Shader = {};
THREE.TrailRenderer.Renderer.Shader.VertexVars = [

	"attribute float nodeID;",
	"attribute vec3 nodeCenter;",

	"uniform float minID;",
	"uniform float maxID;",
	"uniform float trailLength;",

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
		"float fraction = ( maxID - nodeID ) / ( maxID - minID );",
		"vColor = ( 1.0 - fraction ) * headColor + fraction * tailColor;",
		"vec4 realPosition = vec4( ( 1.0 - fraction ) * position.xyz + fraction * nodeCenter.xyz, 1.0 ); ", 
		"gl_Position = projectionMatrix * viewMatrix * realPosition;",

	"}"

].join( "\n" );

THREE.TrailRenderer.Renderer.Shader.FragmentShader = [

	THREE.TrailRenderer.Renderer.Shader.FragmentVars,

	"void main() { ",

	    "vec4 textureColor = texture2D( texture, vUV );",
		//"gl_FragColor = vColor * textureColor;",
		"gl_FragColor = vColor;",

	"}"

].join( "\n" );

THREE.TrailRenderer.Renderer.createMaterial = function( vertexShader, fragmentShader, customUniforms ) {

	customUniforms = customUniforms || {};

	customUniforms.trailLength = { type: "f", value: null };
	customUniforms.minID = { type: "f", value: null };
	customUniforms.maxID = { type: "f", value: null };

	customUniforms.headColor = { type: "v4", value: new THREE.Vector4() };
	customUniforms.tailColor = { type: "v4", value: new THREE.Vector4() };

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
		depthWrite: false,

		side: THREE.DoubleSide
	} );

}

THREE.TrailRenderer.Renderer.prototype.initialize = function() {

	this.nodeIDs = [];
	this.nodeCenters = [];
	for (var i = 0; i < this.length; i ++ ) {

		this.nodeIDs[ i ] = -1;
		this.nodeCenters[ i ] = new THREE.Vector3();

	}

	this.initializeGeometry();
	this.initializeMesh();

	this.material.uniforms.trailLength.value = this.length;
	this.material.uniforms.minID.value = 0;
	this.material.uniforms.maxID.value = 0;

	this.reset( new THREE.Vector3() );

}

THREE.TrailRenderer.Renderer.prototype.initializeGeometry = function() {

	this.vertexCount = this.length * this.VerticesPerNode;
	this.faceCount = this.length * this.FacesPerNode;

	var geometry = new THREE.BufferGeometry();

	var nodeIDs = new Float32Array( this.vertexCount );
	var positions = new Float32Array( this.vertexCount * 3  );
	var nodeCenters = new Float32Array( this.vertexCount * 3  );
	var uvs = new Float32Array( this.vertexCount * 2  );
	var indices = new Uint32Array( this.faceCount * 3 );

	var nodeIDAttribute = new THREE.BufferAttribute( nodeIDs, 1 );
	nodeIDAttribute.setDynamic( true );
	geometry.addAttribute( 'nodeID', nodeIDAttribute );

	var nodeCenterAttribute = new THREE.BufferAttribute( nodeCenters, 3 );
	nodeCenterAttribute.setDynamic( true );
	geometry.addAttribute( 'nodeCenter', nodeCenterAttribute );

	var positionAttribute = new THREE.BufferAttribute( positions, 3 );
	positionAttribute.setDynamic( true );
	geometry.addAttribute( 'position', positionAttribute );

	var uvAttribute = new THREE.BufferAttribute( uvs, 2 );
	uvAttribute.setDynamic( true );
	geometry.addAttribute( 'uv', uvAttribute );

	var indexAttribute = new THREE.BufferAttribute( indices, 1 );
	indexAttribute.setDynamic( true );
	geometry.setIndex( indexAttribute );

	this.geometry = geometry;

}

THREE.TrailRenderer.Renderer.prototype.zeroVertices = function( ) {

	var positions = this.geometry.getAttribute( 'position' );

	for ( var i = 0; i < this.vertexCount; i ++ ) {

		var index = i * 3;

		positions.array[ index ] = 0;
		positions.array[ index + 1 ] = 0;
		positions.array[ index + 2 ] = 0;

	}

	positions.needsUpdate = true;

}

THREE.TrailRenderer.Renderer.prototype.zeroIndices = function( ) {

	var indices = this.geometry.getIndex();

	for ( var i = 0; i < this.faceCount; i ++ ) {

		var index = i * 3;

		indices.array[ index ] = 0;
		indices.array[ index + 1 ] = 0;
		indices.array[ index + 2 ] = 0;

	}

	indices.needsUpdate = true;

}

THREE.TrailRenderer.Renderer.prototype.formInitialFaces = function() {

	this.zeroIndices();

	var indices = this.geometry.getIndex();

	for ( var i = 0; i < this.length - 1; i ++ ) {

		this.connectNodes( i, i + 1 );

	}

	indices.needsUpdate = true;

}

THREE.TrailRenderer.Renderer.prototype.initializeMesh = function() {

	this.destroyMesh();

	this.mesh = new THREE.Mesh( this.geometry, this.material );
	this.mesh.dynamic = true;
	this.mesh.matrixAutoUpdate = false;

}

THREE.TrailRenderer.Renderer.prototype.destroyMesh = function() {

	if ( this.mesh ) {

		this.scene.remove( this.mesh );
		this.trailMesh = null;

	}

}

THREE.TrailRenderer.Renderer.prototype.reset = function() {

	this.currentLength = 0;
	this.currentEnd = -1;
	this.lastPosition = null;

	this.formInitialFaces();
	this.zeroVertices();

	this.geometry.setDrawRange( 0, 0 );

}

THREE.TrailRenderer.Renderer.prototype.advance = function() {

	var orientationTangent = new THREE.Vector3();
	var position = new THREE.Vector3();
	var offset = new THREE.Vector3();
	var tempMatrix4 = new THREE.Matrix4();

	return function advance() {

		this.targetObject.updateMatrixWorld();
		tempMatrix4.copy( this.targetObject.matrixWorld );

		/*orientationTangent.copy( THREE.TrailRenderer.LocalOrientationTangent );
		position.copy( THREE.TrailRenderer.LocalHeadOrigin );
		offset.setFromMatrixPosition( tempMatrix4 );
		position.add( offset );
		orientationTangent.applyMatrix4( tempMatrix4 );
		orientationTangent.normalize();
		this.advanceWithPositionAndOrientation( position, orientationTangent );*/

		this.advanceWithTransform( tempMatrix4 );
		
		this.updateUniforms();
	}

}();

THREE.TrailRenderer.Renderer.prototype.updateUniforms = function() {

	this.material.uniforms.maxID.value = this.currentNodeID;
	this.material.uniforms.minID.value = this.currentNodeID - this.length;

}

THREE.TrailRenderer.Renderer.prototype.advanceWithPositionAndOrientation = function( nextPosition, orientationTangent ) {

	this.advanceGeometry( { position : nextPosition, tangent : orientationTangent }, null );

}

THREE.TrailRenderer.Renderer.prototype.advanceWithTransform = function( transformMatrix ) {

	this.advanceGeometry( null, transformMatrix );

}


THREE.TrailRenderer.Renderer.prototype.advanceGeometry = function() { 

	var direction = new THREE.Vector3();
	var tempPosition = new THREE.Vector3();

	return function advanceGeometry( positionAndOrientation, transformMatrix ) {

		if ( this.currentLength >= 1 ) {

			var nextIndex = this.currentEnd + 1 >= this.length ? 0 : this.currentEnd + 1; 

			if( transformMatrix ) {

				this.updateNodePositionsFromTransformMatrix( nextIndex, transformMatrix );

			} else {

				this.updateNodePositionsFromOrientationTangent( nextIndex, positionAndOrientation.position, positionAndOrientation.tangent );
			}

			this.connectNodes( this.currentEnd , nextIndex );

			if( this.currentLength >= this.length ) {

				var disconnectIndex  = this.currentEnd + 1  >= this.length ? 0 : this.currentEnd + 1;
				this.disconnectNodes( disconnectIndex );

			}

		}

		if( this.currentLength < this.length ) {

			this.currentLength ++;

		}

		this.currentEnd ++;
		if ( this.currentEnd >= this.length ) {

			this.currentEnd = 0;

		}

		if ( this.currentLength >= 1 ) {

			if( this.currentLength < this.length ) {

				this.geometry.setDrawRange( 0, ( this.currentLength - 1 ) * this.FaceIndicesPerNode);

			} else {

				this.geometry.setDrawRange( 0, this.currentLength * this.FaceIndicesPerNode);

			}

		}

		if ( transformMatrix ) {

			tempPosition.set( 0, 0, 0 );
			tempPosition.applyMatrix4( transformMatrix );
			this.updateNodeCenter( this.currentEnd, tempPosition );

		} else {

			this.updateNodeCenter( this.currentEnd, positionAndOrientation.position );

		}
		
		this.updateNodeID( this.currentEnd,  this.currentNodeID );
		this.currentNodeID ++;
	}

}();

THREE.TrailRenderer.Renderer.prototype.updateNodeID = function( nodeIndex, id ) { 

	this.nodeIDs[ nodeIndex ] = id;

	var nodeIDs = this.geometry.getAttribute( 'nodeID' );

	for ( var i = 0; i < this.VerticesPerNode; i ++ ) {

		var baseIndex = nodeIndex * this.VerticesPerNode + i ;
		nodeIDs.array[ baseIndex ] = id;

	}	

	nodeIDs.needsUpdate = true;

}

THREE.TrailRenderer.Renderer.prototype.updateNodeCenter = function( nodeIndex, nodeCenter ) { 

	this.nodeCenters[ nodeIndex ].copy( nodeCenter );

	var nodeCenters = this.geometry.getAttribute( 'nodeCenter' );

	for ( var i = 0; i < this.VerticesPerNode; i ++ ) {

		var baseIndex = ( nodeIndex * this.VerticesPerNode + i ) * 3;
		nodeCenters.array[ baseIndex ] = nodeCenter.x;
		nodeCenters.array[ baseIndex + 1 ] = nodeCenter.y;
		nodeCenters.array[ baseIndex + 2 ] = nodeCenter.z;

	}	

	nodeCenters.needsUpdate = true;

}

THREE.TrailRenderer.Renderer.prototype.updateNodePositionsFromOrientationTangent = function() { 

	var tempMatrix4 = new THREE.Matrix4();
	var tempQuaternion = new THREE.Quaternion();
	var tempOffset = new THREE.Vector3();
	var tempLocalHeadGeometry = [];

	for ( var i = 0; i < THREE.TrailRenderer.MaxHeadVertices; i ++ ) {

		var vertex = new THREE.Vector3();
		tempLocalHeadGeometry.push( vertex );

	}

	return function updateNodePositionsFromOrientationTangent( nodeIndex, nodeCenter, orientationTangent  ) {

		var positions = this.geometry.getAttribute( 'position' );

		tempOffset.copy( nodeCenter );
		tempOffset.sub( THREE.TrailRenderer.LocalHeadOrigin );
		tempQuaternion.setFromUnitVectors( THREE.TrailRenderer.LocalOrientationTangent, orientationTangent );
		
		for ( var i = 0; i < this.localHeadGeometry.length; i ++ ) {

			var vertex = tempLocalHeadGeometry[ i ];
			vertex.copy( this.localHeadGeometry[ i ] );
			vertex.applyQuaternion( tempQuaternion );
			vertex.add( tempOffset );
		}

		for ( var i = 0; i <  this.localHeadGeometry.length; i ++ ) {

			var positionIndex = ( ( this.VerticesPerNode * nodeIndex ) + i ) * 3;
			var transformedHeadVertex = tempLocalHeadGeometry[ i ];

			positions.array[ positionIndex ] = transformedHeadVertex.x;
			positions.array[ positionIndex + 1 ] = transformedHeadVertex.y;
			positions.array[ positionIndex + 2 ] = transformedHeadVertex.z;

		}

		positions.needsUpdate = true;
	}

}();

THREE.TrailRenderer.Renderer.prototype.updateNodePositionsFromTransformMatrix = function() { 

	var tempMatrix4 = new THREE.Matrix4();
	var tempPosition = new THREE.Vector3();
	var tempLocalHeadGeometry = [];

	for ( var i = 0; i < THREE.TrailRenderer.MaxHeadVertices; i ++ ) {

		var vertex = new THREE.Vector3();
		tempLocalHeadGeometry.push( vertex );

	}

	return function updateNodePositionsFromTransformMatrix( nodeIndex, transformMatrix ) {

		var positions = this.geometry.getAttribute( 'position' );
	
		for ( var i = 0; i < this.localHeadGeometry.length; i ++ ) {

			var vertex = tempLocalHeadGeometry[ i ];
			vertex.copy( this.localHeadGeometry[ i ] );
			vertex.applyMatrix4( transformMatrix );
		}

		for ( var i = 0; i <  this.localHeadGeometry.length; i ++ ) {

			var positionIndex = ( ( this.VerticesPerNode * nodeIndex ) + i ) * 3;
			var transformedHeadVertex = tempLocalHeadGeometry[ i ];

			positions.array[ positionIndex ] = transformedHeadVertex.x;
			positions.array[ positionIndex + 1 ] = transformedHeadVertex.y;
			positions.array[ positionIndex + 2 ] = transformedHeadVertex.z;

		}

		positions.needsUpdate = true;
	}

}();

THREE.TrailRenderer.Renderer.prototype.connectNodes = function( srcNodeIndex, destNodeIndex ) {

	var indices = this.geometry.getIndex();

	for ( var i = 0; i < this.localHeadGeometry.length - 1; i ++ ) {

		var srcVertexIndex = ( this.VerticesPerNode * srcNodeIndex ) + i;
		var destVertexIndex = ( this.VerticesPerNode * destNodeIndex ) + i;

		var faceIndex = ( ( srcNodeIndex * this.FacesPerNode ) + ( i * 2 ) ) * 3;

		indices.array[ faceIndex ] = srcVertexIndex;
		indices.array[ faceIndex + 1 ] = destVertexIndex;
		indices.array[ faceIndex + 2 ] = srcVertexIndex + 1;

		indices.array[ faceIndex + 3 ] = destVertexIndex;
		indices.array[ faceIndex + 4 ] = destVertexIndex + 1;
		indices.array[ faceIndex + 5 ] = srcVertexIndex + 1;

	}

	indices.needsUpdate = true;

}

THREE.TrailRenderer.Renderer.prototype.disconnectNodes = function( srcNodeIndex ) {

	var indices = this.geometry.getIndex();

	for ( var i = 0; i < this.localHeadGeometry.length - 1; i ++ ) {

		var srcVertexIndex = ( this.VerticesPerNode * srcNodeIndex ) + i;

		var faceIndex = ( ( srcNodeIndex * this.FacesPerNode ) + ( i * 2 ) ) * 3;

		indices.array[ faceIndex ] = 0;
		indices.array[ faceIndex + 1 ] = 0;
		indices.array[ faceIndex + 2 ] = 0;

		indices.array[ faceIndex + 3 ] = 0;
		indices.array[ faceIndex + 4 ] = 0;
		indices.array[ faceIndex + 5 ] = 0;

	}

	indices.needsUpdate = true;

}

THREE.TrailRenderer.Renderer.prototype.deactivate = function() {

	if ( this.isActive ) {

		this.scene.remove( this.mesh );
		this.isActive = false;

	}

}

THREE.TrailRenderer.Renderer.prototype.activate = function() {

	if ( ! this.isActive ) {

		this.scene.add( this.mesh );
		this.isActive = true;

	}

}

THREE.TrailRenderer.Renderer.prototype.getVector3FromAttribute = function( attribute, nodeIndex, subIndex, target ) {

	var offset = 0;
	if ( subIndex ) offset += 3;

	var x = attribute.array[ nodeIndex * 3 + offset ];
	var y = attribute.array[ nodeIndex * 3 + offset + 1 ];
	var z = attribute.array[ nodeIndex * 3 + offset + 2 ];

	target.set( x, y, z );

}


