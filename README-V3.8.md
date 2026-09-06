# IMPACTONE Daily V3.8

This revision makes two targeted corrections while preserving subscribe/share/favorite/comment, font-size controls, scan folding, footer, backend hooks and social share links.

1. Header skyline: the approved sample building artwork is used at its original aspect ratio. The previous V3.7 bug was caused by `width:100%; height:100%; object-fit:fill`, which stretched the skyline horizontally and changed the Empire State Building and surrounding towers. V3.8 crops the building artwork and uses `height:auto` plus proportional positioning, with separate ground curves.
2. WeChat sharing: the WeChat button no longer copies the link and no longer invokes `weixin://`. On browsers supporting `navigator.share`, it invokes the native share sheet so mobile users can choose WeChat directly. Desktop browsers that cannot expose WeChat as a system share target show an explanatory message instead of silently copying.
