/* Achica el cuerpo de texto hasta que ninguna línea se pase de ancho.
   Las líneas van en .l con white-space:nowrap, así el corte de línea lo decide
   el HTML y NUNCA el wrap del navegador: el texto quemado es exactamente el del plan. */
document.querySelectorAll('[data-ajustar]').forEach(function (box) {
  var px = parseFloat(getComputedStyle(box).fontSize);
  var cabe = function () {
    var w = box.clientWidth;
    return [].every.call(box.querySelectorAll('.l'), function (l) { return l.scrollWidth <= w; });
  };
  while (!cabe() && px > 24) { px -= 2; box.style.fontSize = px + 'px'; }
});
