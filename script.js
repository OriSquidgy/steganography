$('button.encode, button.decode').click(function(event) {
  event.preventDefault();
});

function previewDecodeImage() {
  var file = document.querySelector('input[name=decodeFile]').files[0];

  previewImage(file, ".decode canvas", function() {
    $(".decode").fadeIn();
  });
}

function previewEncodeImage() {
  var file = document.querySelector("input[name=baseFile]").files[0];

  $(".images .nulled").hide();
  $(".images .message").hide();

  previewImage(file, ".original canvas", function() {
    $(".images .original").fadeIn();
    $(".images").fadeIn();
  });
}

function previewImage(file, canvasSelector, callback) {
  var $canvas = $(canvasSelector);
  var context = $canvas[0].getContext('2d');

  if (!file) return;

  file.arrayBuffer().then(function(buffer) {
    var bytes = new Uint8Array(buffer);
    var imageBlob;

    // Normal PNG: use directly
    var isPNG =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4E &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0D &&
      bytes[5] === 0x0A &&
      bytes[6] === 0x1A &&
      bytes[7] === 0x0A;

    if (isPNG) {
      imageBlob = new Blob([buffer], { type: "image/png" });
    }

    // beheader ICO/MP4 polyglot
    else {
      var view = new DataView(buffer);

      // ICO header: 00 00 01 00
      var isICO =
        bytes[0] === 0x00 &&
        bytes[1] === 0x00 &&
        bytes[2] === 0x01 &&
        bytes[3] === 0x00;

      if (!isICO) {
        throw new Error("Unsupported image/polyglot format");
      }

      // beheader stores PNG size and offset in the ICO directory entry
      var pngSize   = view.getUint32(14, true);
      var pngOffset = view.getUint32(18, true);

      if (
        pngOffset <= 0 ||
        pngSize <= 0 ||
        pngOffset + pngSize > buffer.byteLength
      ) {
        throw new Error("Invalid embedded PNG");
      }

      var pngData = buffer.slice(
        pngOffset,
        pngOffset + pngSize
      );

      imageBlob = new Blob([pngData], { type: "image/png" });
    }

    var url = URL.createObjectURL(imageBlob);
    var image = new Image();

    image.onload = function() {
      $canvas.prop({
        width: image.width,
        height: image.height
      });

      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);

      callback();
    };

    image.onerror = function() {
      URL.revokeObjectURL(url);
      console.error("Could not decode embedded image");
    };

    image.src = url;
  });
}

function encodeMessage() {
  $(".error").hide();
  $(".binary").hide();

  var text = $("textarea.message").val();

  var $originalCanvas = $('.original canvas');
  var $nulledCanvas = $('.nulled canvas');
  var $messageCanvas = $('.message canvas');

  var originalContext = $originalCanvas[0].getContext("2d");
  var nulledContext = $nulledCanvas[0].getContext("2d");
  var messageContext = $messageCanvas[0].getContext("2d");

  var width = $originalCanvas[0].width;
  var height = $originalCanvas[0].height;

  // Check if the image is big enough to hide the message
  if ((text.length * 8) > (width * height * 3)) {
    $(".error")
      .text("Text too long for chosen image....")
      .fadeIn();

    return;
  }

  $nulledCanvas.prop({
    'width': width,
    'height': height
  });

  $messageCanvas.prop({
    'width': width,
    'height': height
  });

  // Normalize the original image and draw it
  var original = originalContext.getImageData(0, 0, width, height);
  var pixel = original.data;
  for (var i = 0, n = pixel.length; i < n; i += 4) {
    for (var offset =0; offset < 3; offset ++) {
      if(pixel[i + offset] %2 != 0) {
        pixel[i + offset]--;
      }
    }
  }
  nulledContext.putImageData(original, 0, 0);

  // Convert the message to a binary string
  var binaryMessage = "";
  for (i = 0; i < text.length; i++) {
    var binaryChar = text[i].charCodeAt(0).toString(2);

    // Pad with 0 until the binaryChar has a lenght of 8 (1 Byte)
    while(binaryChar.length < 8) {
      binaryChar = "0" + binaryChar;
    }

    binaryMessage += binaryChar;
  }
  $('.binary textarea').text(binaryMessage);

  // Apply the binary string to the image and draw it
  var message = nulledContext.getImageData(0, 0, width, height);
  pixel = message.data;
  counter = 0;
  for (var i = 0, n = pixel.length; i < n; i += 4) {
    for (var offset =0; offset < 3; offset ++) {
      if (counter < binaryMessage.length) {
        pixel[i + offset] += parseInt(binaryMessage[counter]);
        counter++;
      }
      else {
        break;
      }
    }
  }
  messageContext.putImageData(message, 0, 0);

  $(".binary").fadeIn();
  $(".images .nulled").fadeIn();
  $(".images .message").fadeIn();
};

function decodeMessage() {
  var $originalCanvas = $('.decode canvas');
  var originalContext = $originalCanvas[0].getContext("2d");

  var original = originalContext.getImageData(0, 0, $originalCanvas[0].width, $originalCanvas[0].height);
  var binaryMessage = "";
  var pixel = original.data;
  for (var i = 0, n = pixel.length; i < n; i += 4) {
    for (var offset =0; offset < 3; offset ++) {
      var value = 0;
      if(pixel[i + offset] %2 != 0) {
        value = 1;
      }

      binaryMessage += value;
    }
  }

  var output = "";
  for (var i = 0; i < binaryMessage.length; i += 8) {
    var c = 0;
    for (var j = 0; j < 8; j++) {
      c <<= 1;
      c |= parseInt(binaryMessage[i + j]);
    }

    output += String.fromCharCode(c);
  }

  $('.binary-decode textarea').text(output);
  $('.binary-decode').fadeIn();
};