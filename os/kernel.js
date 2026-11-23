/* ========================================
   GeoOS - Kernel (compat shim)
   The window-manager implementation now lives in
   frontend/js/windowManager.js. This file is kept only as a thin
   re-export so the legacy os/index.html bootloader and the deploy
   script keep working against the single live implementation.
   ======================================== */

export { WindowManager as Kernel } from '../frontend/js/windowManager.js';

window.geoosKernel = null;
