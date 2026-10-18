(function () {
  var d = document.documentElement;
  var auto = 'light';
  try {
    var h = new Date().getHours();
    auto = (h < 6 || h >= 19) ? 'dark' : 'light';

    // a manual pick only holds while the ambient day/night state is unchanged
    var saved = localStorage.getItem('theme');
    var at = localStorage.getItem('themeAuto');
    if ((saved === 'light' || saved === 'dark') && at === auto) {
      d.setAttribute('data-theme', saved);
    } else {
      d.setAttribute('data-theme', auto);
    }
  } catch (e) {
    d.setAttribute('data-theme', auto);
  }
  d.classList.add('js');
})();
