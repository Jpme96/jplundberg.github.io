/* Empty cards fold down to one line (the heading plus a short hint) until they have something
   in them, so the dashboard stays short. Tap the heading to open one anyway. */
(function () {
  "use strict";
  var dash = document.getElementById('dash');
  if (!dash) return;
  /* card → is it empty? */
  var CHECK = {
    todo: function (c) { return !c.querySelector('#todoList li'); },
    notes: function (c) { return !c.querySelector('#noteList li'); },
    goals: function (c) { return !c.querySelector('#goalList li') && c.querySelector('#goalForm').hidden; },
    links: function (c) { return !c.querySelector('#linkGrid li'); },
    savings: function (c) { return !c.querySelector('#svList li') && c.querySelector('#svForm').hidden; },
    networth: function (c) { return !c.querySelector('#nwList li') && c.querySelector('#nwForm').hidden; },
    bills: function (c) { return !c.querySelector('#billsBody li'); }
  };
  var HINT = {
    todo: 'Nothing to do', notes: 'No notes', goals: 'No goals yet', links: 'No links yet',
    savings: 'No savings goals', networth: 'No accounts yet', bills: 'No fixed costs with a due date'
  };
  var opened = {};
  function pass() {
    Object.keys(CHECK).forEach(function (id) {
      var c = document.querySelector('.card.' + id);
      if (!c) return;
      var empty = false;
      try { empty = CHECK[id](c); } catch (e) {}
      var fold = empty && !opened[id];
      if (c.classList.contains('card-folded') === fold) return;
      c.classList.toggle('card-folded', fold);
      var h = c.querySelector('.card-head');
      if (!h) return;
      var hint = h.querySelector('.fold-hint');
      if (fold) {
        if (!hint) { hint = document.createElement('button'); hint.type = 'button'; hint.className = 'fold-hint'; h.appendChild(hint); }
        hint.innerHTML = '<span>' + HINT[id] + '</span><i class="bi bi-plus-lg"></i>';
      } else if (hint) hint.remove();
    });
  }
  document.addEventListener('click', function (e) {
    var h = e.target.closest('.card-folded .card-head');
    if (!h || e.target.closest('a, [data-review], [data-quick]')) return;
    var c = h.closest('.card'), id = Object.keys(CHECK).filter(function (k) { return c.classList.contains(k); })[0];
    if (!id) return;
    opened[id] = true; pass();
    var f = c.querySelector('input:not([type=hidden]), textarea, button.text-btn');
    if (id === 'goals') { var b = c.querySelector('#goalAddBtn'); if (b) b.click(); }
    else if (id === 'savings') { var sb = c.querySelector('#svAddBtn'); if (sb) sb.click(); }
    else if (id === 'networth') { var nb = c.querySelector('#nwAddBtn'); if (nb) nb.click(); }
    else if (f && matchMedia('(hover: hover)').matches) f.focus();
  });
  var t = null;
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(pass, 60); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  if (window.Vault) { window.Vault.onUnlock(function () { opened = {}; setTimeout(pass, 100); }); }
  setTimeout(pass, 0);
})();
