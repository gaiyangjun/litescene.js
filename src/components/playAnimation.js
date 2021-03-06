/**
* Reads animation tracks from an Animation resource and applies the properties to the objects referenced
* @class PlayAnimation
* @constructor
* @param {String} object to configure from
*/


function PlayAnimation(o)
{
	this.enabled = true;
	this.animation = "";
	this.take = "default";
	this.root_node = "@";
	this.playback_speed = 1.0;
	this.mode = PlayAnimation.LOOP;
	this.playing = true;
	this.current_time = 0;
	this._last_time = 0;
	this.range = null;

	this.disabled_tracks = {};

	if(o)
		this.configure(o);
}

PlayAnimation.LOOP = 1;
PlayAnimation.PINGPONG = 2;
PlayAnimation.ONCE = 3;
PlayAnimation.PAUSED = 4;

PlayAnimation.MODES = {"loop":PlayAnimation.LOOP, "pingpong":PlayAnimation.PINGPONG, "once":PlayAnimation.ONCE, "paused":PlayAnimation.PAUSED };

PlayAnimation["@animation"] = { widget: "animation" };
PlayAnimation["@root_node"] = { type: "node" };
PlayAnimation["@mode"] = { type:"enum", values: PlayAnimation.MODES };

PlayAnimation.prototype.configure = function(o)
{
	if(o.play) //LEGACY
		delete o.play;

	if(o.enabled)
		this.enabled = true;
	if(o.range) 
		this.range = o.range.concat();
	if(o.mode !== undefined) 
		this.mode = o.mode;
	if(o.animation)
		this.animation = o.animation;
	if(o.take)
		this.take = o.take;
	if(o.playback_speed != null)
		this.playback_speed = parseFloat( o.playback_speed );
	if(o.root_node !== undefined)
		this.root_node = o.root_node;
	if(o.playing !== undefined)
		this.playing = o.playing;
}


PlayAnimation.icon = "mini-icon-clock.png";

PlayAnimation.prototype.onAddedToScene = function(scene)
{
	LEvent.bind( scene, "update", this.onUpdate, this);
}


PlayAnimation.prototype.onRemovedFromScene = function(scene)
{
	LEvent.unbind( scene, "update", this.onUpdate, this);
}


PlayAnimation.prototype.getAnimation = function()
{
	if(!this.animation || this.animation[0] == "@") 
		return this._root.scene.animation;
	var anim = LS.ResourcesManager.getResource( this.animation );
	if( anim && anim.constructor === LS.Animation )
		return anim;
	return null;
}

PlayAnimation.prototype.onUpdate = function(e, dt)
{
	if(!this.enabled)
		return;

	if(!this.playing)
		return;

	if( this.mode != PlayAnimation.PAUSED )
		this.current_time += dt * this.playback_speed;

	var animation = this.getAnimation();
	if(!animation) 
		return;

	var take = animation.takes[ this.take ];
	if(!take) 
		return;

	var time = this.current_time;

	var start_time = 0;
	var duration = take.duration;
	var end_time = duration;

	if(this.range)
	{
		start_time = this.range[0];
		end_time = this.range[1];
		duration = end_time - start_time;
	}

	if(time > end_time)
	{
		switch( this.mode )
		{
			case PlayAnimation.ONCE: 
				time = end_time; 
				//time = start_time; //reset after
				LEvent.trigger( this, "end_animation" );
				this.playing = false;
				break;
			case PlayAnimation.PINGPONG:
				if( ((time / duration)|0) % 2 == 0 ) //TEST THIS
					time = this.current_time % duration; 
				else
					time = duration - (this.current_time % duration);
				break;
			case PlayAnimation.PINGPONG:
				time = end_time; 
				break;
			case PlayAnimation.LOOP: 
			default: 
				time = ((this.current_time - start_time) % duration) + start_time;
				LEvent.trigger( this, "animation_loop" );
				break;
		}
	}
	else if(time < start_time)
		time = start_time;

	this.applyAnimation( time, this._last_time );

	this._last_time = time; //TODO, add support for pingpong events in tracks
	//take.actionPerSample( this.current_time, this._processSample.bind( this ), { disabled_tracks: this.disabled_tracks } );

	var scene = this._root.scene;
	if(scene)
		scene.refresh();
}


PlayAnimation.prototype.play = function()
{
	this.playing = true;

	this.current_time = 0;
	if(this.range)
		this.current_time = this.range[0];
	this._last_time = this.current_time;
	LEvent.trigger( this, "start_animation" );

	//this.applyAnimation( this.current_time );
}

PlayAnimation.prototype.pause = function()
{
	this.playing = false;
}

PlayAnimation.prototype.stop = function()
{
	this.playing = false;

	this.current_time = 0;
	if(this.range)
		this.current_time = this.range[0];
	this._last_time = this.current_time;
	//this.applyAnimation( this.current_time );
}

PlayAnimation.prototype.playRange = function( start, end )
{
	this.playing = true;
	this.current_time = start;
	this._last_time = this.current_time;
	this.range = [ start, end ];
}

PlayAnimation.prototype.applyAnimation = function( time, last_time )
{
	if( last_time === undefined )
		last_time = time;

	var animation = this.getAnimation();
	if(!animation) 
		return;

	var take = animation.takes[ this.take ];
	if(!take) 
		return;

	var root_node = null;
	if(this.root_node && this._root.scene)
	{
		if(this.root_node == "@")
			root_node = this._root;
		else
			root_node = this._root.scene.getNode( this.root_node );
	}
	take.applyTracks( time, last_time, undefined, root_node );
}

PlayAnimation.prototype._processSample = function(nodename, property, value, options)
{
	var scene = this._root.scene;
	if(!scene)
		return;
	var node = scene.getNode(nodename);
	if(!node) 
		return;
		
	var trans = node.transform;

	switch(property)
	{
		case "translate.X": if(trans) trans.position[0] = value; break;
		case "translate.Y": if(trans) trans.position[1] = value; break;
		case "translate.Z": if(trans) trans.position[2] = value; break;
		//NOT TESTED
		/*
		case "rotateX.ANGLE": if(trans) trans.rotation[0] = value * DEG2RAD; break;
		case "rotateY.ANGLE": if(trans) trans.rotation[1] = value * DEG2RAD; break;
		case "rotateZ.ANGLE": if(trans) trans.rotation[2] = value * DEG2RAD; break;
		*/
		case "matrix": if(trans) trans.fromMatrix(value); break;
		default: break;
	}
	
	if(node.transform)
		node.transform.updateMatrix();
}

PlayAnimation.prototype.getResources = function(res)
{
	if(this.animation)
		res[ this.animation ] = LS.Animation;
}

PlayAnimation.prototype.onResourceRenamed = function (old_name, new_name, resource)
{
	if(this.animation == old_name)
		this.animation = new_name;
}

//returns which events can trigger this component
PlayAnimation.prototype.getEvents = function()
{
	return { "start_animation": "event", "end_animation": "event" };
}

//returns which actions can be triggered in this component
PlayAnimation.prototype.getEventActions = function()
{
	return { "play": "function","pause": "function","stop": "function" };
}


LS.registerComponent( PlayAnimation );