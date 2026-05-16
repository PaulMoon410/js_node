window.addEventListener('DOMContentLoaded', function() {
  var canvas = document.getElementById('renderCanvas');
  var engine = new BABYLON.Engine(canvas, true);

  var createScene = function() {
    var scene = new BABYLON.Scene(engine);
    var camera = new BABYLON.UniversalCamera('FPSCamera', new BABYLON.Vector3(0, 2, -10), scene);
    camera.attachControl(canvas, true);
    camera.speed = 0.5;
    camera.inertia = 0.7;
    camera.angularSensibility = 4000;
    camera.keysUp.push(87);    // W
    camera.keysDown.push(83);  // S
    camera.keysLeft.push(65);  // A
    camera.keysRight.push(68); // D

    var light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), scene);
    var ground = BABYLON.MeshBuilder.CreateGround('ground', {width: 50, height: 50}, scene);
    var box = BABYLON.MeshBuilder.CreateBox('box', {size: 2}, scene);
    box.position.y = 1;

    return scene;
  };

  var scene = createScene();
  engine.runRenderLoop(function() {
    scene.render();
  });
  window.addEventListener('resize', function() {
    engine.resize();
  });
});
