/*
 * eSheep - Webpage desktop pet
 * Original author: Adriano Petrucci (http://esheep.petrucci.ch)
 * Original project: https://github.com/Adrianotiger/web-esheep
 * Version: 0.9.2
 *
 * CheetahOS customizations:
 *  - Resources are pulled from the local osdrive path (no external CDN).
 *  - The pet (and its info popup) are mounted inside the desktop container
 *    (id="vantaCntnr") instead of document.body, at a desktop-level z-index.
 *  - The "floor" tracks the CheetahOS taskbar (.task-bar-nav): when the
 *    taskbar is visible the pet stands on top of it; when it auto-hides the
 *    floor drops to the bottom of the viewport. The floor is recomputed every
 *    animation step and the pet is actively re-clamped so it rises back onto
 *    the taskbar the moment the taskbar reappears.
 */

// Wrapped in an IIFE so the top-level `const`/`class` declarations stay
// function-scoped. The CheetahOS desktop can unload this script and load it
// again (Stop/Start eSheep); without the wrapper a reload would throw
// "Identifier 'eSheep' has already been declared" because lexical globals
// survive removing the <script> tag. Only `window.eSheep` is exported.
(function(){

const VERSION = '0.9.2';              // web eSheep version
const ACTIVATE_DEBUG = false;         // show log on console
const DEFAULT_XML = "osdrive/Program-Files/esheep64/animation.xml"; // default XML animation (local)
const PETS_JSON = "osdrive/Program-Files/esheep64/Pets/pets.json";  // pet list (local)
const PETS_PATH = "osdrive/Program-Files/esheep64/Pets/";           // pet animation files (local)
const CONTAINER_ID = "vantaCntnr";    // CheetahOS desktop container element id
const TASKBAR_SELECTOR = ".task-bar-nav"; // CheetahOS taskbar element
const WINDOW_SELECTOR = ".window-container"; // CheetahOS app window the pet can land on
const WINDOW_PACE_LIMIT = 4;          // edge turns before the pet walks off (back & forth twice)

// Resolve the desktop container the pet lives in (falls back to <body>).
function eSheepContainer()
{
  return document.getElementById(CONTAINER_ID) || document.body;
}

  /*
   * eSheep class.
   * Create a new class of this type if you want a new pet. Will create the components for the pet.
   * Once created, you can call [variableName].Start() to start the animation with your desired pet.
   */
class eSheep
{
    /* Parameters for options [default]:
     * - allowPets: [none], all
     * - allowPopup: [yes], no
     */
  constructor(options, isChild)
  {
    this.userOptions = options ? options : {allowPets : "none", allowPopup : "yes"};
    if(!this.userOptions.allowPopup) this.userOptions.allowPopup = "yes";
    if(!this.userOptions.allowPets) this.userOptions.allowPets = "none";

      // CORS: Cross calls are not accepted by new browsers.
    this.animationFile = DEFAULT_XML;

    this.id = Date.now() + Math.random();

    this.DOMdiv = document.createElement("div");    // Div added to webpage, containing the sheep
    this.DOMdiv.setAttribute("id", this.id);
    this.DOMimg = document.createElement("img");    // Tile image, will be positioned inside the div
    this.DOMinfo = document.createElement("div");   // about dialog, if you press on the sheep

    this.parser = new DOMParser();                  // XML parser
    this.xmlDoc = null;                             // parsed XML Document
    this.prepareToDie = false;                      // when removed, animations should be stopped

    this.isChild = (isChild != null);               // Child will be removed once they reached the end

    this.tilesX = 1;                                // Quantity of images inside Tile
    this.tilesY = 1;                                // Quantity of images inside Tile
    this.imageW = 1;                                // Width of the sprite image
    this.imageH = 1;                                // Height of the sprite image
    this.imageX = 1;                                // Position of sprite inside webpage
    this.imageY = 1;                                // Position of sprite inside webpage
    this.flipped = false;                           // if sprite is flipped
    this.dragging = false;                          // if user is dragging the sheep
    this.infobox = false;                           // if infobox is visible
    this.animationId = 0;                           // current animation ID
    this.animationStep = 0;                         // current animation step
    this.animationNode = null;                      // current animation DOM node
    this.sprite = new Image();                      // sprite image (Tiles)
    this.HTMLelement = null;                        // the HTML element where the pet is walking on
    this.windowEdgeHits = 0;                        // times the pet turned back at a window edge
    this.randS = Math.random() * 100;               // random value, will change when page is reloaded

    this.screenW = window.innerWidth
                  || document.documentElement.clientWidth
                  || document.body.clientWidth;     // window width

    this.screenH = this._floorH();                  // walking floor (taskbar-aware)

    eSheep._register(this);                         // track for eSheep.removeAll()
  }

    /*
     * Current floor height for the pet.
     * Returns the top edge of the CheetahOS taskbar when it is on-screen,
     * otherwise the full viewport height (taskbar hidden / not present).
     */
  _floorH()
  {
    var h = window.innerHeight
          || document.documentElement.clientHeight
          || document.body.clientHeight;

    var bar = document.querySelector(TASKBAR_SELECTOR);
    if(bar)
    {
      var rect = bar.getBoundingClientRect();
      // When the taskbar slides down to hide (bottom:-40px) its top sits at
      // (or below) the viewport edge, so this clamp leaves the floor at `h`.
      if(rect.top < h) h = rect.top;
    }
    return h;
  }

    /*
     * Start new animation on the page.
     * if animation is not set, the default sheep will be taken
     */
  Start(animation)
  {
    if(typeof animation !== 'undefined' &&
      animation != null)
    {
      this.animationFile = animation;
    }

    var ajax = new XMLHttpRequest();
    var sheepClass = this;

    ajax.open("GET", this.animationFile, true);
    ajax.addEventListener("readystatechange", function() {
      if(this.readyState == 4)
      {
        if(this.status == 200)
            // successfully loaded XML, parse it and create first esheep.
          sheepClass._parseXML(this.responseText);
        else
          console.error("XML not available:" + this.statusText + "\n" + this.responseText);
      }
    });
    ajax.send(null);
  }

  remove() {
    this.prepareToDie = true;
    if(this.DOMinfo && typeof this.DOMinfo.Hide === "function") this.DOMinfo.Hide();
    eSheep._unregister(this);
    var id = this.id;
    setTimeout(()=>{
      this.DOMdiv = this.DOMimg = this.DOMinfo = null;
      var el = document.getElementById(id);
      if(el) el.outerHTML = '';
    }, 500);
  }

  /*
   * Static registry of live pets (root pets, animation children and pets
   * spawned from the popup all register on construction). Lets the host
   * tear every pet down with a single eSheep.removeAll() call.
   */
  static _register(inst) {
    if(!eSheep._instances) eSheep._instances = [];
    eSheep._instances.push(inst);
  }

  static _unregister(inst) {
    if(!eSheep._instances) return;
    var i = eSheep._instances.indexOf(inst);
    if(i >= 0) eSheep._instances.splice(i, 1);
  }

  static removeAll() {
    if(!eSheep._instances) return;
    var copy = eSheep._instances.slice();
    for(var i=0;i<copy.length;i++) {
      try { copy[i].remove(); } catch(e) { /* already gone */ }
    }
    eSheep._instances = [];
  }

    /*
     * Parse loaded XML, contains spawn, animations and childs
     */
  _parseXML(text)
  {
    this.xmlDoc = this.parser.parseFromString(text,'text/xml');
    var image = this.xmlDoc.getElementsByTagName('image')[0];
    this.tilesX = image.getElementsByTagName("tilesx")[0].textContent;
    this.tilesY = image.getElementsByTagName("tilesy")[0].textContent;
      // Event listener: Sprite was loaded =>
      //   play animation only when the sprite is loaded
    this.sprite.addEventListener("load", () =>
    {
      if(ACTIVATE_DEBUG) console.log("Sprite image loaded");
      var attribute =
      "width:" + (this.sprite.width) + "px;" +
      "height:" + (this.sprite.height) + "px;" +
      "position:absolute;" +
      "top:0px;" +
      "left:0px;" +
      "max-width: none;";
      this.DOMimg.setAttribute("style", attribute);
        // prevent to move image (will show the entire sprite sheet if not catched)
      this.DOMimg.addEventListener("dragstart", e => {e.preventDefault(); return false;});
      this.imageW = this.sprite.width / this.tilesX;
      this.imageH = this.sprite.height / this.tilesY;
      attribute =
        "width:" + (this.imageW) + "px;" +
        "height:" + (this.imageH) + "px;" +
        "position:fixed;" +
        "top:" + (this.imageY) + "px;" +
        "left:" + (this.imageX) + "px;" +
        "transform:rotatey(0deg);" +
        "cursor:move;" +
        "z-index:4;" +
        "overflow:hidden;" +
        "image-rendering: crisp-edges;";
      this.DOMdiv.setAttribute("style", attribute);
      this.DOMdiv.appendChild(this.DOMimg);

      if(this.isChild)
        this._spawnChild();
      else
        this._spawnESheep();
    });


    this.sprite.src = 'data:image/png;base64,' + image.getElementsByTagName("png")[0].textContent;
    this.DOMimg.setAttribute("src", this.sprite.src);

    // Mouse move over eSheep, check if eSheep should be moved over the screen
    this.DOMdiv.addEventListener("mousemove", e =>
    {
      if(!this.dragging && e.buttons==1 && e.button==0)
      {
        this.dragging = true;
        this.HTMLelement = null;
        var childsRoot = this.xmlDoc.getElementsByTagName('animations')[0];
        var childs = childsRoot.getElementsByTagName('animation');
        for(var k=0;k<childs.length;k++)
        {
          if(childs[k].getElementsByTagName('name')[0].textContent == "drag")
          {
            this.animationId = childs[k].getAttribute("id");
            this.animationStep = 0;
            this.animationNode = childs[k];
            break;
          }
        }
      }
    });
    // Add event listener to body, if mouse moved too fast over the dragging eSheep
    document.body.addEventListener("mousemove", e =>
    {
      if(this.dragging)
      {
        this.imageX = parseInt(e.clientX) - this.imageW/2;
        this.imageY = parseInt(e.clientY) - this.imageH/2;

        this.DOMdiv.style.left = this.imageX + "px";
        this.DOMdiv.style.top = this.imageY + "px";
        this.DOMinfo.style.left = parseInt(this.imageX + this.imageW/2) + "px";
        this.DOMinfo.style.top = this.imageY + "px";
      }
    });
    // Window resized, recalculate eSheep bounds
    window.addEventListener("resize", () =>
    {
      this.screenW = window.innerWidth
                || document.documentElement.clientWidth
                || document.body.clientWidth;

      this.screenH = this._floorH();

      if(this.imageY + this.imageH > this.screenH)
      {
        this.imageY = this.screenH - this.imageH;
        this.DOMdiv.style.top = this.imageY + "px";
      }
      if(this.imageX + this.imageW > this.screenW)
      {
        this.imageX = this.screenW - this.imageW;
        this.DOMdiv.style.left = this.imageX + "px";
      }
    });
    // Don't allow contextmenu over the sheep
    this.DOMdiv.addEventListener("contextmenu", e => {
      e.preventDefault();
      return false;
    });
    // Mouse released
    this.DOMdiv.addEventListener("mouseup", e => {
      if(this.dragging)
      {
        this.dragging = false;
      }
      else if(this.infobox)
      {
        // this.DOMinfo.Hide();
        // this.infobox = false;
      }
      else
      {
        if(this.userOptions.allowPopup === "yes")
        {
          this.DOMinfo.style.left = Math.min(this.screenW-this.imageW, Math.max(this.imageW, parseInt(this.imageX + this.imageW/2))) + "px";
          this.DOMinfo.style.top = parseInt(this.imageY) + "px";
          // this.DOMinfo.Show();
          // this.infobox = true;
        }
      }
    });
    // Mouse released over the info box
    // this.DOMinfo.addEventListener("mouseup", e => {
    //   this.DOMinfo.Hide();
    //   this.infobox = false;
    // });
      // Create About box
    var attribute =
      "width:200px;" +
      "height:100px;" +
      "transform:translate(-50%, -50%) scale(0.1);" +
      "position:fixed;" +
      "top:100px;left:10px;" +
      "display:none;" +
      "border-width:2px;" +
      "border-radius:5px;" +
      "border-style:ridge;" +
      "border-color:#0000ab;" +
      "text-align:center;" +
      "text-shadow: 1px 1px 3px #ffff88;" +
      "box-shadow: 3px 3px 10px #888888;" +
      "color:black;" +
      "opacity:0.9;" +
      "z-index:9999;" +
      "overflow:auto;" +
      "transition:transform 0.3s ease;" +
      "background: linear-gradient(to bottom right, rgba(128,128,255,0.7), rgba(200,200,255,0.4));";
    this.DOMinfo.setAttribute("style",attribute);
    var headerNode = this.xmlDoc.getElementsByTagName('header')[0];
    var htmlT = document.createElement("b").appendChild(document.createTextNode(headerNode.getElementsByTagName('title')[0].textContent));
    var htmlV = document.createElement("sup");
    var htmlL = document.createElement("a");
    var htmlP = document.createElement("p");
    htmlV.appendChild(document.createTextNode("App v." + VERSION));
    htmlV.appendChild(document.createElement("br"));
    htmlV.appendChild(document.createTextNode("Pet v." + headerNode.getElementsByTagName('version')[0].textContent));
    htmlV.setAttribute("style", "float:right;text-align:right;");
    htmlL.appendChild(document.createTextNode("\u{1F3E0}"));
    htmlL.setAttribute("href", "https://github.com/Adrianotiger/web-esheep");
    htmlL.setAttribute("target", "_blank");
    htmlL.setAttribute("style", "float:left");
    htmlP.appendChild(document.createTextNode(headerNode.getElementsByTagName('info')[0].textContent));
    htmlP.setAttribute("style", "font-size:" + (100 - parseInt(headerNode.getElementsByTagName('info')[0].textContent.length / 10)) + "%;");
    this.DOMinfo.appendChild(htmlV);
    this.DOMinfo.appendChild(htmlL);
    if(this.userOptions.allowPets !== "none")
    {
      htmlL = document.createElement("a");
      htmlL.appendChild(document.createTextNode("\u{2699}"));
      htmlL.setAttribute("href", "javascript:;");
      htmlL.setAttribute("style", "float:left");
      this.DOMinfo.appendChild(htmlL);
      setTimeout(()=>{this._loadPetList(htmlL);},100);
    }
    this.DOMinfo.appendChild(htmlT);
    this.DOMinfo.appendChild(document.createElement("br"));
    this.DOMinfo.appendChild(document.createElement("hr"));
    this.DOMinfo.appendChild(htmlP);
      // Add about and sheep elements to the desktop container
    var container = eSheepContainer();
    container.appendChild(this.DOMinfo);
    container.appendChild(this.DOMdiv);

    // this.DOMinfo.Show = () => {
    //   this.DOMinfo.style.display = "block";
    //   this.DOMinfo.style.transform = "translate(-50%, -100%) scale(1.0)";
    // }
    // this.DOMinfo.Hide = () => {
    //   this.DOMinfo.style.transform = "translate(-50%, -50%) scale(0.1)";
    //   setTimeout(()=>{this.DOMinfo.style.display = "none";}, 300);
    // }
  };

    /*
     * Set new position for the pet
     * If absolute is true, the x and y coordinates are used as absolute values.
     * If false, x and y are added to the current position
     */
  _setPosition(x, y, absolute)
  {
    if (this.DOMdiv) {
      if(absolute)
      {
        this.imageX = parseInt(x);
        this.imageY = parseInt(y);
      }
      else
      {
        this.imageX = parseInt(this.imageX) + parseInt(x);
        this.imageY = parseInt(this.imageY) + parseInt(y);
      }
      this.DOMdiv.style.left = this.imageX + "px";
      this.DOMdiv.style.top = this.imageY + "px";
    }
  }

    /*
     * Spawn new esheep, this is called if the XML was loaded successfully
     */
  _spawnESheep()
  {
    var spawnsRoot = this.xmlDoc.getElementsByTagName('spawns')[0];
    var spawns = spawnsRoot.getElementsByTagName('spawn');
    var prob = 0;
    for(var i=0;i<spawns.length;i++)
      prob += parseInt(spawns[0].getAttribute("probability"));
    var rand = Math.random() * prob;
    prob = 0;
    for(i=0;i<spawns.length;i++)
    {
      prob += parseInt(spawns[i].getAttribute("probability"));
      if(prob >= rand || i == spawns.length-1)
      {
        this._setPosition(
          this._parseKeyWords(spawns[i].getElementsByTagName('x')[0].textContent),
          this._parseKeyWords(spawns[i].getElementsByTagName('y')[0].textContent),
          true
        );
        if(ACTIVATE_DEBUG) console.log("Spawn: " + this.imageX + ", " + this.imageY);
        this.animationId = spawns[i].getElementsByTagName('next')[0].textContent;
        this.animationStep = 0;
        var childsRoot = this.xmlDoc.getElementsByTagName('animations')[0];
        var childs = childsRoot.getElementsByTagName('animation');
        for(var k=0;k<childs.length;k++)
        {
          if(childs[k].getAttribute("id") == this.animationId)
          {
            this.animationNode = childs[k];

              // Check if child should be loaded toghether with this animation
            var childsRoot = this.xmlDoc.getElementsByTagName('childs')[0];
            var childs = childsRoot.getElementsByTagName('child');
            for(var j=0;j<childs.length;j++)
            {
              if(childs[j].getAttribute("animationid") == this.animationId)
              {
                if(ACTIVATE_DEBUG) console.log("Child from Spawn");
                var eSheepChild = new eSheep(null, true);
                eSheepChild.animationId = childs[j].getElementsByTagName('next')[0].textContent;
                var x = childs[j].getElementsByTagName('x')[0].textContent;//
                var y = childs[j].getElementsByTagName('y')[0].textContent;
                eSheepChild._setPosition(this._parseKeyWords(x), this._parseKeyWords(y), true);
                // Start animation
                eSheepChild.Start(this.animationFile);
                break;
              }
            }
            break;
          }
        }
        break;
      }
    }
      // Play next step
    this._nextESheepStep();
  }

    /*
     * Like spawnESheep, but for Childs
     */
  _spawnChild()
  {
    var childsRoot = this.xmlDoc.getElementsByTagName('animations')[0];
    var childs = childsRoot.getElementsByTagName('animation');
    for(var k=0;k<childs.length;k++)
    {
      if(childs[k].getAttribute("id") == this.animationId)
      {
        this.animationNode = childs[k];
        break;
      }
    }
    this._nextESheepStep();
  }

    // Parse the human readable expression from XML to a computer readable expression
  _parseKeyWords(value)
  {
    value = value.replace(/screenW/g, this.screenW);
    value = value.replace(/screenH/g, this.screenH);
    value = value.replace(/areaW/g, this.screenH);
    value = value.replace(/areaH/g, this.screenH);
    value = value.replace(/imageW/g, this.imageW);
    value = value.replace(/imageH/g, this.imageH);
    value = value.replace(/random/g, Math.random()*100);
    value = value.replace(/randS/g, this.randS);
    value = value.replace(/imageX/g, this.imageX);
    value = value.replace(/imageY/g, this.imageY);

    var ret = 0;
    try
    {
      ret = eval(value);
    }
    catch(err)
    {
      console.error("Unable to parse this position: \n'" + value + "'\n Error message: \n" + err.message);
    }
    return ret;
  }

    /*
     * Once the animation is over, get the next animation to play
     */
  _getNextRandomNode(parentNode)
  {
    var baseNode = parentNode.getElementsByTagName('next');
    var childsRoot = this.xmlDoc.getElementsByTagName('animations')[0];
    var childs = childsRoot.getElementsByTagName('animation');
    var prob = 0;
    var nodeFound = false;

      // no more animations (it was the last one)
    if(baseNode.length == 0)
    {
        // If it is a child, remove the child from document
      if(this.isChild)
      {
        // remove child
        if(ACTIVATE_DEBUG) console.log("Remove child");
        var container = eSheepContainer();
        container.removeChild(this.DOMinfo);
        container.removeChild(this.DOMdiv);
        delete this;
      }
        // else, spawn sheep again
      else
      {
        this._spawnESheep();
      }
      return false;
    }

    for(var k=0;k<baseNode.length;k++)
    {
      prob += parseInt(baseNode[k].getAttribute("probability"));
    }
    var rand = Math.random() * prob;
    var index = 0;
    prob = 0;
    for(k=0;k<baseNode.length;k++)
    {
      prob += parseInt(baseNode[k].getAttribute("probability"));
      if(prob >= rand)
      {
        index = k;
        break;
      }
    }
    for(k=0;k<childs.length;k++)
    {
      if(childs[k].getAttribute("id") == baseNode[index].textContent)
      {
        this.animationId = childs[k].getAttribute("id");
        this.animationStep = 0;
        this.animationNode = childs[k];
        nodeFound = true;
        break;
      }
    }

    if(nodeFound) // create Child, if present
    {
      var childsRoot = this.xmlDoc.getElementsByTagName('childs')[0];
      var childs = childsRoot.getElementsByTagName('child');
      for(k=0;k<childs.length;k++)
      {
        if(childs[k].getAttribute("animationid") == this.animationId)
        {
          if(ACTIVATE_DEBUG) console.log("Child from Animation");
          var eSheepChild = new eSheep(null, true);
          eSheepChild.animationId = childs[k].getElementsByTagName('next')[0].textContent;
          var x = childs[k].getElementsByTagName('x')[0].textContent;//
          var y = childs[k].getElementsByTagName('y')[0].textContent;
          eSheepChild._setPosition(this._parseKeyWords(x), this._parseKeyWords(y), true);
          eSheepChild.Start(this.animationFile);
          break;
        }
      }
    }

    return nodeFound;
  }

    /*
     * Check if the sheep is standing on the top edge of a visible CheetahOS
     * app window. Returns the window element when the pet's feet are at its
     * top edge (and horizontally over it), otherwise false. Minimized,
     * hidden or zero-size windows are ignored so the pet falls through them.
     */
  _checkOverlapping()
  {
    var x = this.imageX;
    var y = this.imageY + this.imageH;   // sheep's feet
    var margin = 20;
    if(this.HTMLelement) margin = 5;     // tighter band once already standing

    var els = document.querySelectorAll(WINDOW_SELECTOR);
    for(var i=0;i<els.length;i++)
    {
      var el = els[i];
      var rect = el.getBoundingClientRect();

      // Ignore windows that are not actually on-screen.
      if(rect.width <= 0 || rect.height <= 0) continue;
      var style = window.getComputedStyle(el);
      if(style.display == "none" || style.visibility == "hidden" || parseFloat(style.opacity) === 0) continue;

      // Feet at the window's top edge and horizontally over the window.
      if(y > rect.top - 2 && y < rect.top + margin)
      {
        if(x > rect.left && x < rect.right - this.imageW)
        {
          return el;
        }
      }
    }
    return false;
  }

    /*
     * Try to get the value of a node (from the current animationNode), if it is not possible returns the defaultValue
     */
  _getNodeValue(nodeName, valueName, defaultValue)
  {
    if(!this.animationNode || !this.animationNode.getElementsByTagName(nodeName)) return;
    if(this.animationNode.getElementsByTagName(nodeName)[0].getElementsByTagName(valueName)[0])
    {
      var value = this.animationNode.getElementsByTagName(nodeName)[0].getElementsByTagName(valueName)[0].textContent;

      return this._parseKeyWords(value);
    }
    else
    {
      return defaultValue;
    }
  }

    /*
     * Next step (each frame is a step)
     */
  _nextESheepStep()
  {
    if(this.prepareToDie) return;

    // Keep the floor in sync with the live taskbar position, and actively
    // lift the pet onto the taskbar if the floor just rose (taskbar shown).
    this.screenH = this._floorH();
    if(this.imageY + this.imageH > this.screenH)
    {
      this.imageY = this.screenH - this.imageH;
      if(this.DOMdiv) this.DOMdiv.style.top = this.imageY + "px";
    }

    var x1 = this._getNodeValue('start','x',0);
    var y1 = this._getNodeValue('start','y',0);
    var off1 = this._getNodeValue('start','offsety',0);
    var opa1 = this._getNodeValue('start','opacity',1);
    var del1 = this._getNodeValue('start','interval',1000);
    var x2 = this._getNodeValue('end','x',0);
    var y2 = this._getNodeValue('end','y',0);
    var off2 = this._getNodeValue('end','offsety',0);
    var opa2 = this._getNodeValue('end','interval',1);
    var del2 = this._getNodeValue('end','interval',1000);

    var repeat = this._parseKeyWords(this.animationNode.getElementsByTagName('sequence')[0].getAttribute('repeat'));
    var repeatfrom = this.animationNode.getElementsByTagName('sequence')[0].getAttribute('repeatfrom');
    var gravity = this.animationNode.getElementsByTagName('gravity');
    var border = this.animationNode.getElementsByTagName('border');

    var steps = this.animationNode.getElementsByTagName('frame').length +
                (this.animationNode.getElementsByTagName('frame').length - repeatfrom) * repeat;

    var index;

    if(this.animationStep < this.animationNode.getElementsByTagName('frame').length)
      index = this.animationNode.getElementsByTagName('frame')[this.animationStep].textContent;
    else if(repeatfrom == 0)
      index = this.animationNode.getElementsByTagName('frame')[this.animationStep % this.animationNode.getElementsByTagName('frame').length].textContent;
    else
      index = this.animationNode.getElementsByTagName('frame')[parseInt(repeatfrom) + parseInt((this.animationStep - repeatfrom) % (this.animationNode.getElementsByTagName('frame').length - repeatfrom))].textContent;

    this.DOMimg.style.left = (- this.imageW * (index % this.tilesX)) + "px";
    this.DOMimg.style.top = (- this.imageH * parseInt(index / this.tilesX)) + "px";

    if(this.dragging || this.infobox)
    {
      this.animationStep++;
      setTimeout(this._nextESheepStep.bind(this), 50);
      return;
    }

    if(this.flipped)
    {
      x1 = -x1;
      x2 = -x2;
    }

    if(this.animationStep == 0)
      this._setPosition(x1, y1, false);
    else
      this._setPosition(
                          parseInt(x1) + parseInt((x2-x1)*this.animationStep/steps),
                          parseInt(y1) + parseInt((y2-y1)*this.animationStep/steps),
                          false);

    this.animationStep++;

    if(this.animationStep >= steps)
    {
      if(this.animationNode.getElementsByTagName('action')[0])
      {
        switch(this.animationNode.getElementsByTagName('action')[0].textContent)
        {
          case "flip":
            if(this.DOMdiv.style.transform == "rotateY(0deg)")
            {
              this.DOMdiv.style.transform = "rotateY(180deg)";
              this.flipped = true;
            }
            else
            {
              this.DOMdiv.style.transform = "rotateY(0deg)";
              this.flipped = false;
            }
            break;
          default:

            break;
        }
      }
      if(!this._getNextRandomNode(this.animationNode.getElementsByTagName('sequence')[0])) return;
    }

    var setNext = false;

    if(border && border[0] && border[0].getElementsByTagName('next'))
    {
      if(x2<0 && this.imageX < 0)
      {
        this.imageX = 0;
        setNext = true;
      }
      else if(x2 > 0 && this.imageX > this.screenW - this.imageW)
      {
        this.imageX = this.screenW - this.imageW;
        this.DOMdiv.style.left = parseInt(this.imageX) + "px";
        setNext = true;
      }
      else if(y2 < 0 && this.imageY < 0)
      {
        this.imageY = 0;
        setNext = true;
      }
      else if(y2 > 0 && this.imageY > this.screenH - this.imageH)
      {
        this.imageY = this.screenH - this.imageH;
        setNext = true;
      }
      else if(y2 > 0)
      {
        if(this._checkOverlapping())
        {
          if(this.imageY > this.imageH)
          {
            this.HTMLelement = this._checkOverlapping();
            this.windowEdgeHits = 0;
            this.imageY = Math.ceil(this.HTMLelement.getBoundingClientRect().top) - this.imageH;
            setNext = true;
          }
        }
      }
      else if(this.HTMLelement)
      {
        if(!this._checkOverlapping())
        {
          if(this.imageY + this.imageH > this.HTMLelement.getBoundingClientRect().top + 3 ||
             this.imageY + this.imageH < this.HTMLelement.getBoundingClientRect().top - 3)
          {
            this.HTMLelement = null;
            this.windowEdgeHits = 0;
          }
          else if(this.windowEdgeHits >= WINDOW_PACE_LIMIT)
          {
            // Paced back and forth twice already - walk off the cliff and let gravity drop it.
            this.HTMLelement = null;
            this.windowEdgeHits = 0;
          }
          else if(this.imageX < this.HTMLelement.getBoundingClientRect().left)
          {
            this.windowEdgeHits++;
            this.imageX = parseInt(this.imageX + 3);
            setNext = true;
            this.DOMdiv.style.left = parseInt(this.imageX) + "px";
          }
          else
          {
            this.windowEdgeHits++;
            this.imageX = parseInt(this.imageX - 3);
            setNext = true;
            this.DOMdiv.style.left = parseInt(this.imageX) + "px";
          }
        }
      }
      if(setNext)
      {
        if(!this._getNextRandomNode(border[0])) return;
      }
    }
    if(!setNext && gravity && gravity[0] && gravity[0].getElementsByTagName('next'))
    {
      if(this.imageY < this.screenH - this.imageH - 2)
      {
        if(this.HTMLelement == null)
        {
          setNext = true;
        }
        else
        {
          if(!this._checkOverlapping())
          {
            setNext = true;
            this.HTMLelement = null;
          }
        }

        if(setNext)
        {
          if(!this._getNextRandomNode(gravity[0])) return;
        }
      }
    }
    if(!setNext)
    {
      if(this.imageX < - this.imageW && x2 < 0 ||
        this.imageX > this.screenW && x2 > 0 ||
        this.imageY < - this.imageH && y1 < 0 ||
        this.imageY > this.screenH && y2 > 0)
      {
        setNext = true;
        if(!this.isChild) {
          this._spawnESheep();
        }
        return;
      }
    }

    setTimeout(
      this._nextESheepStep.bind(this),
      parseInt(del1) + parseInt((del2 - del1) * this.animationStep / steps)
    );
  }

  /*
   * Load Pet List (local), so user can change it
   */
  _loadPetList(element)
  {
    fetch(PETS_JSON,
    {
      credentials: 'same-origin',
      cache: "force-cache"
    }).then(response => {
      return response.json();
    }).then(json => {
      console.log(json);
      if(json.pets)
      {
        element.addEventListener("mouseup", e => {
          e.preventDefault();
          e.stopPropagation();

          var div = document.createElement("div");
          div.setAttribute("style", "position:absolute;left:0px;top:20px;width:183px;min-height:100px;background:linear-gradient(to bottom, #8080ff, #3030a1);color:yellow;");
          element.parentNode.appendChild(div);

          for(let k in json.pets)
          {
            var pet = document.createElement("b");
            pet.setAttribute("style", "cursor:pointer;display:block;");
            pet.appendChild(document.createTextNode(json.pets[k].name));
            pet.addEventListener("click", ()=>{
              var x = new eSheep(this.userOptions);
              x.Start(PETS_PATH + json.pets[k].file);
              this.remove();
            });
            div.appendChild(pet);
          }

          div.addEventListener("click", e => {element.parentNode.removeChild(div);});
        });
      }
    });
  }
};

// Expose the constructor globally so non-module loaders (and the CheetahOS
// desktop component) can reach it via window.eSheep.
window.eSheep = eSheep;

})();
