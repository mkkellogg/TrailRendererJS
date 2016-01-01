/**
* @author Mark Kellogg - http://www.github.com/mkkellogg
*/

//=======================================
// Trail Renderer
//=======================================

THREE.TrailRenderer = function( scene, orientToMovement ) {

	THREE.Object3D.call( this );

	this.active = false;

	this.orientToMovement = false;
	if ( orientToMovement ) this.orientToMovement = true;

	this.scene = scene;

	this.geometry = null;
	this.mesh = null;
	this.nodeCenters = null;

	this.lastNodeCenter = null;
	this.currentNodeCenter = null;
	this.lastOrientationDir = null;
	this.nodeIDs = null;
	this.currentLength = 0;
	this.currentEnd = 0;
	this.currentNodeID = 0;

}

THREE.TrailRenderer.prototype = Object.create( THREE.Object3D.prototype );
THREE.TrailRenderer.constructor = THREE.TrailRenderer;

THREE.TrailRenderer.MaxHeadVertices = 128;
THREE.TrailRenderer.LocalOrientationTangent = new THREE.Vector3( 1, 0, 0 );
THREE.TrailRenderer.LocalOrientationDirection = new THREE.Vector3( 0, 0, -1 );
THREE.TrailRenderer.LocalHeadOrigin = new THREE.Vector3( 0, 0, 0 );

THREE.TrailRenderer.Shader = {};
THREE.TrailRenderer.Shader.VertexVars = [

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

THREE.TrailRenderer.Shader.FragmentVars = [

	"varying vec2 vUV;",
	"varying vec4 vColor;",

	"uniform sampler2D texture;",

].join( "\n" );

THREE.TrailRenderer.Shader.VertexShader = [

	THREE.TrailRenderer.Shader.VertexVars,

	"void main() { ",

		"vUV = uv; ",
		"float fraction = ( maxID - nodeID ) / ( maxID - minID );",
		"vColor = ( 1.0 - fraction ) * headColor + fraction * tailColor;",
		"vec4 realPosition = vec4( ( 1.0 - fraction ) * position.xyz + fraction * nodeCenter.xyz, 1.0 ); ", 
		"gl_Position = projectionMatrix * viewMatrix * realPosition;",

	"}"

].join( "\n" );

THREE.TrailRenderer.Shader.FragmentShader = [

	THREE.TrailRenderer.Shader.FragmentVars,

	"void main() { ",

	    "vec4 textureColor = texture2D( texture, vUV );",
		//"gl_FragColor = vColor * textureColor;",
		"gl_FragColor = vColor;",

	"}"

].join( "\n" );

THREE.TrailRenderer.createMaterial = function( vertexShader, fragmentShader, customUniforms ) {

	customUniforms = customUniforms || {};

	customUniforms.trailLength = { type: "f", value: null };
	customUniforms.minID = { type: "f", value: null };
	customUniforms.maxID = { type: "f", value: null };

	customUniforms.headColor = { type: "v4", value: new THREE.Vector4() };
	customUniforms.tailColor = { type: "v4", value: new THREE.Vector4() };

	vertexShader = vertexShader || THREE.TrailRenderer.Shader.VertexShader;
	fragmentShader = fragmentShader || THREE.TrailRenderer.Shader.FragmentShader;

	return new THREE.ShaderMaterial(
	{
		uniforms: customUniforms,
		vertexShader: vertexShader,
		fragmentShader: fragmentShader,

		transparent: true,
		alphaTest: 0.5,

		blending : THREE.CustomBlending,
		blendSrc : THREE.SrcAlphaFactor,
		blendDst : THREE.OneMinusSrcAlphaFactor,
		blendEquation : THREE.AddEquation,

		depthTest: true,
		depthWrite: false,

		side: THREE.DoubleSide
	} );

}

THREE.TrailRenderer.prototype.initialize = function( material, length, localHeadWidth, localHeadGeometry, targetObject ) {

		this.deactivate();
		this.destroyMesh();

		this.length = ( length > 0 ) ? length + 1 : 0;
		this.targetObject = targetObject;

		this.initializeLocalHeadGeometry( localHeadWidth, localHeadGeometry );

		this.nodeIDs = [];
		this.nodeCenters = [];

		for (var i = 0; i < this.length; i ++ ) {

			this.nodeIDs[ i ] = -1;
			this.nodeCenters[ i ] = new THREE.Vector3();

		}

		this.material = material;

		this.initializeGeometry();
		this.initializeMesh();

		this.material.uniforms.trailLength.value = this.length;
		this.material.uniforms.minID.value = 0;
		this.material.uniforms.maxID.value = 0;

		this.reset();

}

THREE.TrailRenderer.prototype.initializeLocalHeadGeometry = function( localHeadWidth, localHeadGeometry ) {

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

THREE.TrailRenderer.prototype.initializeGeometry = function() {

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

THREE.TrailRenderer.prototype.zeroVertices = function( ) {

	var positions = this.geometry.getAttribute( 'position' );

	for ( var i = 0; i < this.vertexCount; i ++ ) {

		var index = i * 3;

		positions.array[ index ] = 0;
		positions.array[ index + 1 ] = 0;
		positions.array[ index + 2 ] = 0;

	}

	positions.needsUpdate = true;

}

THREE.TrailRenderer.prototype.zeroIndices = function( ) {

	var indices = this.geometry.getIndex();

	for ( var i = 0; i < this.faceCount; i ++ ) {

		var index = i * 3;

		indices.array[ index ] = 0;
		indices.array[ index + 1 ] = 0;
		indices.array[ index + 2 ] = 0;

	}

	indices.needsUpdate = true;

}

THREE.TrailRenderer.prototype.formInitialFaces = function() {

	this.zeroIndices();

	var indices = this.geometry.getIndex();

	for ( var i = 0; i < this.length - 1; i ++ ) {

		this.connectNodes( i, i + 1 );

	}

	indices.needsUpdate = true;

}

THREE.TrailRenderer.prototype.initializeMesh = function() {

	this.mesh = new THREE.Mesh( this.geometry, this.material );
	this.mesh.dynamic = true;
	this.mesh.matrixAutoUpdate = false;

}

THREE.TrailRenderer.prototype.destroyMesh = function() {

	if ( this.mesh ) {

		this.scene.remove( this.mesh );
		this.mesh = null;

	}

}

THREE.TrailRenderer.prototype.reset = function() {

	this.currentLength = 0;
	this.currentEnd = -1;

	this.lastNodeCenter = null;
	this.currentNodeCenter = null;
	this.lastOrientationDir = null;

	this.currentNodeID = 0;

	this.formInitialFaces();
	this.zeroVertices();

	this.geometry.setDrawRange( 0, 0 );

}

THREE.TrailRenderer.prototype.updateUniforms = function() {

	if ( this.currentLength < this.length ) {
		
		this.material.uniforms.minID.value = 0;

	} else {

		this.material.uniforms.minID.value = this.currentNodeID - this.length;

	}
	this.material.uniforms.maxID.value = this.currentNodeID;
	this.material.uniforms.trailLength.value = this.currentLength;

}

THREE.TrailRenderer.prototype.advance = function() {

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

THREE.TrailRenderer.prototype.advanceWithPositionAndOrientation = function( nextPosition, orientationTangent ) {

	this.advanceGeometry( { position : nextPosition, tangent : orientationTangent }, null );

}

THREE.TrailRenderer.prototype.advanceWithTransform = function( transformMatrix ) {

	this.advanceGeometry( null, transformMatrix );

}

THREE.TrailRenderer.prototype.advanceGeometry = function() { 

	var direction = new THREE.Vector3();
	var tempPosition = new THREE.Vector3();

	return function advanceGeometry( positionAndOrientation, transformMatrix ) {

		var nextIndex = this.currentEnd + 1 >= this.length ? 0 : this.currentEnd + 1; 

		if( transformMatrix ) {

			this.updateNodePositionsFromTransformMatrix( nextIndex, transformMatrix );

		} else {

			this.updateNodePositionsFromOrientationTangent( nextIndex, positionAndOrientation.position, positionAndOrientation.tangent );
		}

		if ( this.currentLength >= 1 ) {

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
		
		this.updateNodeID( this.currentEnd,  this.currentNodeID );
		this.currentNodeID ++;
	}

}();

THREE.TrailRenderer.prototype.updateHead = function() {

	var tempMatrix4 = new THREE.Matrix4();

	return function advance() {

		if( this.currentEnd < 0 ) return;

		this.targetObject.updateMatrixWorld();
		tempMatrix4.copy( this.targetObject.matrixWorld );

		this.updateNodePositionsFromTransformMatrix( this.currentEnd, tempMatrix4 );
	}

}();

THREE.TrailRenderer.prototype.updateNodeID = function( nodeIndex, id ) { 

	this.nodeIDs[ nodeIndex ] = id;

	var nodeIDs = this.geometry.getAttribute( 'nodeID' );

	for ( var i = 0; i < this.VerticesPerNode; i ++ ) {

		var baseIndex = nodeIndex * this.VerticesPerNode + i ;
		nodeIDs.array[ baseIndex ] = id;

	}	

	nodeIDs.needsUpdate = true;

}

THREE.TrailRenderer.prototype.updateNodeCenter = function( nodeIndex, nodeCenter ) { 

	this.lastNodeCenter = this.currentNodeCenter;

	this.currentNodeCenter = this.nodeCenters[ nodeIndex ];
	this.currentNodeCenter.copy( nodeCenter );

	var nodeCenters = this.geometry.getAttribute( 'nodeCenter' );

	for ( var i = 0; i < this.VerticesPerNode; i ++ ) {

		var baseIndex = ( nodeIndex * this.VerticesPerNode + i ) * 3;
		nodeCenters.array[ baseIndex ] = nodeCenter.x;
		nodeCenters.array[ baseIndex + 1 ] = nodeCenter.y;
		nodeCenters.array[ baseIndex + 2 ] = nodeCenter.z;

	}	

	nodeCenters.needsUpdate = true;

}

THREE.TrailRenderer.prototype.updateNodePositionsFromOrientationTangent = function() { 

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

		this.updateNodeCenter( nodeIndex, nodeCenter );

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

THREE.TrailRenderer.prototype.updateNodePositionsFromTransformMatrix = function() { 

	var tempMatrix4 = new THREE.Matrix4();
	var tempMatrix3 = new THREE.Matrix3();
	var tempQuaternion = new THREE.Quaternion();
	var tempPosition = new THREE.Vector3();
	var tempOffset = new THREE.Vector3();
	var worldOrientation = new THREE.Vector3();
	var tempDirection = new THREE.Vector3();

	var tempLocalHeadGeometry = [];
	for ( var i = 0; i < THREE.TrailRenderer.MaxHeadVertices; i ++ ) {

		var vertex = new THREE.Vector3();
		tempLocalHeadGeometry.push( vertex );

	}

	function getMatrix3FromMatrix4( matrix3, matrix4) {

		var e = matrix4.elements;
		matrix3.set( e[0], e[1], e[2],
					 e[4], e[5], e[6],
					 e[8], e[9], e[10] );

	}

	return function updateNodePositionsFromTransformMatrix( nodeIndex, transformMatrix ) {

		var positions = this.geometry.getAttribute( 'position' );

		tempPosition.set( 0, 0, 0 );
		tempPosition.applyMatrix4( transformMatrix );
		this.updateNodeCenter( nodeIndex, tempPosition );

		for ( var i = 0; i < this.localHeadGeometry.length; i ++ ) {

			var vertex = tempLocalHeadGeometry[ i ];
			vertex.copy( this.localHeadGeometry[ i ] );

		}

		for ( var i = 0; i < this.localHeadGeometry.length; i ++ ) {

			var vertex = tempLocalHeadGeometry[ i ];
			vertex.applyMatrix4( transformMatrix );

		}
		
		if( this.lastNodeCenter && this.orientToMovement ) {

			getMatrix3FromMatrix4( tempMatrix3, transformMatrix );
			worldOrientation.set( 0, 0, -1 );
			worldOrientation.applyMatrix3( tempMatrix3 );

			tempDirection.copy( this.currentNodeCenter );
			tempDirection.sub( this.lastNodeCenter );
			tempDirection.normalize();

			if( tempDirection.lengthSq() <= .0001 && this.lastOrientationDir ) {
				
				tempDirection.copy( this.lastOrientationDir );
			}

			if( tempDirection.lengthSq() > .0001 ) {

				if( ! this.lastOrientationDir ) this.lastOrientationDir = new THREE.Vector3();

				tempQuaternion.setFromUnitVectors( worldOrientation, tempDirection );

				tempOffset.copy( this.currentNodeCenter );

				for ( var i = 0; i < this.localHeadGeometry.length; i ++ ) {

					var vertex = tempLocalHeadGeometry[ i ];
					vertex.sub( tempOffset );
					vertex.applyQuaternion( tempQuaternion );
					vertex.add( tempOffset );

				}
			}

		}
	
		for ( var i = 0; i < this.localHeadGeometry.length; i ++ ) {

			var positionIndex = ( ( this.VerticesPerNode * nodeIndex ) + i ) * 3;
			var transformedHeadVertex = tempLocalHeadGeometry[ i ];

			positions.array[ positionIndex ] = transformedHeadVertex.x;
			positions.array[ positionIndex + 1 ] = transformedHeadVertex.y;
			positions.array[ positionIndex + 2 ] = transformedHeadVertex.z;

		}
		
		positions.needsUpdate = true;
	}

}();

THREE.TrailRenderer.prototype.connectNodes = function( srcNodeIndex, destNodeIndex ) {

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

THREE.TrailRenderer.prototype.disconnectNodes = function( srcNodeIndex ) {

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

THREE.TrailRenderer.prototype.deactivate = function() {

	if ( this.isActive ) {

		this.scene.remove( this.mesh );
		this.isActive = false;

	}

}

THREE.TrailRenderer.prototype.activate = function() {

	if ( ! this.isActive ) {

		this.scene.add( this.mesh );
		this.isActive = true;

	}

}


