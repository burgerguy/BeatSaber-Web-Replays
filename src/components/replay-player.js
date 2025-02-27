import {clamp} from '../utils';
AFRAME.registerComponent('replay-player', {
	schema: {},

	init: function () {
		this.saberEls = this.el.sceneEl.querySelectorAll('[saber-controls]');

		this.firstSaberControl = this.saberEls[0].components['saber-controls'];
		this.secondSaberControl = this.saberEls[1].components['saber-controls'];

		this.replayDecoder = this.el.sceneEl.components['replay-loader'];
		this.fpsCounter = this.el.sceneEl.components['fps-counter'];
		this.song = this.el.sceneEl.components.song;
		this.cameraXRotationSlider = document.querySelector('#cameraXRotation');
		this.settings = this.el.sceneEl.components.settings;
		this.score = {
			totalScore: 0,
			combo: 0,
			acc: 0,
			lastNoteScore: 0,
			multiplier: 1,
		};

		this.saberEls[0].object3D.position.y = 1.4;
		this.saberEls[0].object3D.position.x = -0.4;

		this.saberEls[1].object3D.position.y = 1.4;
		this.saberEls[1].object3D.position.x = 0.4;

		this.euler = new THREE.Euler();
		this.v1 = new THREE.Vector3();
		this.v2 = new THREE.Vector3();
		this.v3 = new THREE.Vector3();

		this.q1 = new THREE.Quaternion();
		this.q2 = new THREE.Quaternion();
	},

	play: function () {
		this.headset = this.el.sceneEl.querySelectorAll('.headset')[0];
		this.headset.object3D.position.y = 1.75;

		this.povCameraRig = this.el.sceneEl.querySelectorAll('.headCamera')[0];
	},

	tock: function (time, delta) {
		let replay = this.replayDecoder.replay;
		if (replay && !this.headRotationOffset) {
			this.calculateHeadRotationOffset(replay);
			this.supports360 = replay.info.mode == '360Degree' || replay.info.mode == '90Degree';
		}

		if (this.song.isPlaying && replay) {
			const currentTime = this.song.getCurrentTime();
			const frames = this.replayDecoder.replay.frames;
			var frameIndex = 0;
			while (frameIndex < frames.length - 2 && frames[frameIndex + 1].time < currentTime) {
				frameIndex++;
			}
			const frame = frames[frameIndex];
			const nextFrame = frames[frameIndex + 1];

			if (frame.time == 0 && nextFrame.time == 0) return;

			this.fpsCounter.replayFps = frame.fps;
			this.firstSaberControl.frameIndex = frameIndex;
			this.secondSaberControl.frameIndex = frameIndex;

			var replayHeight;
			if (replay.heights.length) {
				var heightFrameIndex = 0;
				while (heightFrameIndex < replay.heights.length - 2 && replay.heights[heightFrameIndex + 1].time < currentTime) {
					heightFrameIndex++;
				}
				replayHeight = replay.heights[heightFrameIndex].height;
			} else {
				replayHeight = replay.info.height;
			}

			let height = clamp((replayHeight - 1.8) * 0.5, -0.2, 0.6);
			let slerpValue = (currentTime - frame.time) / Math.max(1e-6, nextFrame.time - frame.time);

			this.movementsTock(frame, nextFrame, height, slerpValue, delta / 1000);
		}
	},
	movementsTock: function (frame, nextFrame, height, slerpValue, delta) {
		const leftSaber = this.saberEls[0].object3D;
		const rightSaber = this.saberEls[1].object3D;
		const leftHitboxSaber = this.firstSaberControl.hitboxSaber;
		const rightHitboxSaber = this.secondSaberControl.hitboxSaber;
		const headset = this.headset.object3D;
		const povCamera = this.povCameraRig.object3D;

		const offsetInput = document.getElementById('saberOffset');

		const v1 = this.v1;
		const v2 = this.v2;

		v1.set(frame.l.p.x, frame.l.p.y, frame.l.p.z);
		v2.set(nextFrame.l.p.x, nextFrame.l.p.y, nextFrame.l.p.z);
		leftHitboxSaber.position.set(v1.x, v1.y - height, -v1.z);
		const lposition = v1.lerp(v2, slerpValue);
		leftSaber.position.set(lposition.x, lposition.y - height, -lposition.z);

		v1.set(frame.r.p.x, frame.r.p.y, frame.r.p.z);
		v2.set(nextFrame.r.p.x, nextFrame.r.p.y, nextFrame.r.p.z);
		rightHitboxSaber.position.set(v1.x, v1.y - height, -v1.z);
		const rposition = v1.lerp(v2, slerpValue);
		rightSaber.position.set(rposition.x, rposition.y - height, -rposition.z);

		const euler = this.euler;
		const q1 = this.q1;
		const q2 = this.q2;

		q1.set(frame.l.r.w, frame.l.r.z, frame.l.r.y, frame.l.r.x);
		q2.set(nextFrame.l.r.w, nextFrame.l.r.z, nextFrame.l.r.y, nextFrame.l.r.x);
		let lrotation = euler.setFromQuaternion(q1);
		leftHitboxSaber.rotation.set(lrotation.x, lrotation.y + Math.PI, -lrotation.z);

		const lquat = q1.slerp(q2, slerpValue);
		lrotation = euler.setFromQuaternion(lquat);
		leftSaber.rotation.set(lrotation.x, lrotation.y + Math.PI, -lrotation.z);

		q1.set(frame.r.r.w, frame.r.r.z, frame.r.r.y, frame.r.r.x);
		q2.set(nextFrame.r.r.w, nextFrame.r.r.z, nextFrame.r.r.y, nextFrame.r.r.x);
		let rrotation = euler.setFromQuaternion(q1);
		rightHitboxSaber.rotation.set(rrotation.x, rrotation.y + Math.PI, -rrotation.z);

		const rquat = q1.slerp(q2, slerpValue);
		rrotation = euler.setFromQuaternion(rquat);
		rightSaber.rotation.set(rrotation.x, rrotation.y + Math.PI, -rrotation.z);

		if (!!offsetInput) {
			leftSaber.translateZ(-offsetInput.value);
			rightSaber.translateZ(-offsetInput.value);
			document.getElementById('saberOffsetLabel').innerHTML = offsetInput.value;
		}

		v1.set(frame.h.p.x, frame.h.p.y, frame.h.p.z);
		v2.set(nextFrame.h.p.x, nextFrame.h.p.y, nextFrame.h.p.z);
		const hpostion = v1.lerp(v2, slerpValue);
		headset.position.set(hpostion.x, hpostion.y - height, -hpostion.z);

		q1.set(frame.h.r.w, frame.h.r.z, frame.h.r.y, frame.h.r.x);
		q2.set(nextFrame.h.r.w, nextFrame.h.r.z, nextFrame.h.r.y, nextFrame.h.r.x);
		var hquat = q1.slerp(q2, slerpValue);
		var hrotation = euler.setFromQuaternion(hquat);
		headset.rotation.set(hrotation.x, hrotation.y + Math.PI, -hrotation.z + Math.PI);

		this.v3.copy(headset.position);

		if (this.supports360) {
			povCamera.getWorldDirection(this.v1);
			const offset = this.v1.multiplyScalar(parseFloat(this.settings.settings.cameraZPosition));

			this.v3.z += offset.z;
			this.v3.x += offset.x;
		} else {
			this.v3.z += parseFloat(this.settings.settings.cameraZPosition);
		}

		povCamera.position.copy(povCamera.position.lerp(this.v3, 5 * delta));

		if (povCamera.hquat) {
			hquat = povCamera.hquat.slerp(hquat, 5 * delta);
		} else {
			hquat = new THREE.Quaternion().copy(hquat);
		}
		hrotation = euler.setFromQuaternion(hquat);

		let forceForwardLookDirection = this.settings.settings.forceForwardLookDirection;
		let headRotationOffset = this.headRotationOffset;
		if (!this.supports360 && headRotationOffset && forceForwardLookDirection) {
			hrotation.x += headRotationOffset.x;
			hrotation.z += headRotationOffset.z;
			this.cameraXRotationSlider.disabled = true;
		} else {
			hrotation.x += this.settings.settings.cameraXRotation * 0.017453;
			this.cameraXRotationSlider.disabled = false;
		}

		povCamera.rotation.set(hrotation.x, hrotation.y + Math.PI, -hrotation.z + Math.PI);
		povCamera.hquat = hquat;
	},

	calculateHeadRotationOffset: function (replay) {
		const headQ = new THREE.Quaternion(),
			headEuler = new THREE.Euler();
		var x = 0,
			z = 0;
		for (var i = 0; i < replay.frames.length; i++) {
			var rotation = replay.frames[i].h.r;
			headQ.set(rotation.x, rotation.y, rotation.z, rotation.w);
			headEuler.setFromQuaternion(headQ);
			x += headEuler.x;
			z += headEuler.z;
		}
		x /= replay.frames.length;
		z /= replay.frames.length;
		this.headRotationOffset = {x: x, z: z};
	},
});
