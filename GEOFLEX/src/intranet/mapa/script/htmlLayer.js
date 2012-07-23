layerMove = function(targetName, x, y)
{
	var target = document.getElementById(targetName);
	
	target.style.left = x;
	target.style.top = y;
}

layerSize = function(targetName, width, height)
{
	var target = document.getElementById(targetName);
	
	target.style.width = width;
	target.style.height = height;
}

layerShow = function(targetName, show)
{
	var target = document.getElementById(targetName);

	if(show){
		target.style.display = "block";
	}else{
		target.style.display = "none";
	}
}
