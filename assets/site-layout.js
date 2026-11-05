/* Static layout data only. Editing controls live exclusively in tools/. */
(function () {
  'use strict';
  function Container({ as = 'div', group, children, ...props }) {
    const [, refresh] = React.useReducer(n => n + 1, 0);
    React.useEffect(() => {
      const update = () => refresh();
      window.addEventListener('kp-layout-preview', update);
      return () => window.removeEventListener('kp-layout-preview', update);
    }, []);
    const list = React.Children.toArray(children);
    const blocks = list.filter(child => child?.props?.['data-kp-block']);
    const requested = (window.KP_LAYOUT || {})[group];
    const order = Array.isArray(requested) ? requested : [];
    const rank = id => order.includes(id) ? order.indexOf(id) : order.length;
    blocks.sort((a, b) => rank(a.props['data-kp-block']) - rank(b.props['data-kp-block']));
    let slot = 0;
    return React.createElement(as, { ...props, 'data-kp-group': group },
      list.map(child => child?.props?.['data-kp-block'] ? blocks[slot++] : child));
  }
  window.KPLayout = { Container };
})();
