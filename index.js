var Q;
(function (Q) {
    /**
    * An event dispatcher allowing clients to subscribe (tap), unsubscribe (untap) and
    * dispatch (raise) events.
    */
    var Signal = (function () {
        function Signal() {
            // All callbacks that have tapped this signal
            this.listeners = [];
        }
        /**
        * Listen for this signal to be raised.
        * @param l the callback for the listener
        */
        Signal.prototype.tap = function (l) {
            // Make a copy of the listeners to avoid the all too common
            // subscribe-during-dispatch problem
            this.listeners = this.listeners.slice(0);
            this.listeners.push(l);
        };

        /**
        * Stop listening for this signal to be raised.
        * @param l the callback to be removed as a listener
        */
        Signal.prototype.untap = function (l) {
            var ix = this.listeners.indexOf(l);
            if (ix == -1) {
                return;
            }

            // Make a copy of the listeners to avoid the all to common
            // unsubscribe-during-dispatch problem
            this.listeners = this.listeners.slice(0);
            this.listeners.splice(ix, 1);
        };

        /**
        * Raise the signal for all listeners and pass allowing the given arguments.
        * @param args an arbitrary list of arguments to be passed to listeners
        */
        Signal.prototype.raise = function () {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                args[_i] = arguments[_i + 0];
            }
            var _this = this;
            this.listeners.forEach(function (l) {
                l.apply(_this, args);
            });
        };
        return Signal;
    })();
    Q.Signal = Signal;
})(Q || (Q = {}));
/// <reference path="lib/jquery.d.ts" />
/// <reference path="lib/signal.ts" />
/// <reference path="lib/tangle.d.ts" />
var app;
(function (app) {
    function debounce(func, wait, immediate) {
        var timeout;
        return function () {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                args[_i] = arguments[_i + 0];
            }
            var context = this;
            var later = function () {
                timeout = null;
                if (!immediate)
                    func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow)
                func.apply(context, args);
        };
    }
    ;

    var $c = function (name, ns) {
        return ns ? $(document.createElementNS(ns, name)) : $(document.createElement(name));
    };

    var attr = function (e, n, v) {
        e.setAttribute(n, '' + v);
    };

    var on = function (e, t, f) {
        e.addEventListener(t, f, false);
    };

    var SVGNS = 'http://www.w3.org/2000/svg', BASEURL = '2011-to-2017/', MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'], TRANSFORMS = ['-webkit-transform', '-moz-transform', '-ms-transform', '-o-transform', 'transform'];

    var UnpackPoints = function (p) {
        return p.map(function (v) {
            return [v >> 8, v & 0xff];
        });
    };

    var Transform = function (e, tx, r) {
        var v = 'translateX(' + tx + 'px) rotate(' + r + 'deg)';
        TRANSFORMS.forEach(function (t) {
            e.css(t, v);
        });
    };

    var Model = (function () {
        function Model() {
            this.gridDidLoad = new Q.Signal;
            this.zipsDidLoad = new Q.Signal;
            this.zips = {};
            this.pending = {};
            this.prefixes = {};
            this.grids = {};
            this.debouncedLoadGrid = debounce(this.loadGrid, 200, false);
        }
        Model.prototype.loadGrid = function (name) {
            var _this = this;
            console.log("LOADING GRID");
            window['model'] = this;
            console.log(this.grids);
            if (this.grids[name]) {
                console.log("FOUND GRID");
                this.grid = this.grids[name];
                this.gridDidLoad.raise(this);
            } else {
                $.getJSON(BASEURL + name, function (grid) {
                    _this.grids[name] = grid;
                    _this.grid = grid;
                    _this.gridDidLoad.raise(_this);
                });
            }
        };

        Model.prototype.load = function (name) {
            var _this = this;
            this.loadGrid(name);
            window['model'] = this;
            $.getJSON(BASEURL + 'z/root.json', function (zips) {
                _this.zips = zips;
                _this.prefixes[''] = true;
                _this.zipsDidLoad.raise(_this);
            });
        };

        Model.prototype.fetchZips = function (pfx, cb) {
            var pending = this.pending, queue = pending[pfx], zips = this.zips, prefixes = this.prefixes, uri = 'z/' + pfx.substring(0, 1) + '/' + pfx + '.json';

            if (!queue) {
                queue = pending[pfx] = [];
                $.getJSON(BASEURL + uri, function (data) {
                    for (var key in data || {}) {
                        var val = data[key];
                        zips[key] = val;
                        val.Z.forEach(function (v) {
                            zips[v[0]] = v;
                        });
                    }

                    prefixes[pfx] = true;
                    pending[pfx] = null;

                    queue.forEach(function (f) {
                        f();
                    });
                });
            }

            queue.push(cb);
        };

        Model.prototype.findZipCoords = function (zip, cb) {
            var _this = this;
            var zips = this.zips, prefixes = this.prefixes;

            if (zip.length != 5) {
                cb(-1, -1, false);
                return;
            }

            var pfx = zip.substring(0, 3);
            if (prefixes[pfx]) {
                var v = zips[zip], i = v ? v[2] : -1, j = v ? v[3] : -1, k = v != null;
                cb(i, j, k);
                return;
            }

            this.fetchZips(pfx, function () {
                _this.findZipCoords(zip, cb);
            });
        };

        Model.prototype.suggestZipsFor = function (val, cb) {
            var pfx = val.substring(0, val.length - 1), prefixes = this.prefixes, pending = this.pending, zips = this.zips, dispatch = function (z) {
                if (!z) {
                    cb(null, null);
                } else {
                    cb(z.Z, UnpackPoints(z.C || []));
                }
            };

            // if loaded, fire now.
            if (prefixes[pfx]) {
                dispatch(zips[val]);
            } else {
                // otherwise, load it on demand.
                this.fetchZips(pfx, function () {
                    dispatch(zips[val]);
                });
            }

            // prefetch the next level of completion if there is one.
            if (val.length <= 3) {
                this.fetchZips(val, function () {
                });
            }
        };
        return Model;
    })();

    var RegView = (function () {
        function RegView(region) {
            this.region = region;
        }
        return RegView;
    })();

    var CallView = (function () {
        function CallView(root, text, graf, mons) {
            this.root = root;
            this.text = text;
            this.graf = graf;
            this.mons = mons;
        }
        CallView.build = function () {
            var root = $('#call'), text = $('.text', root).text('???'), graf = $('.graf', root), labs = $('.labs', root), mons = [];

            for (var i = 0; i < 12; i++) {
                $c('div').addClass('mnbg').css('left', i * 20).appendTo(graf);

                mons.push($c('div').addClass('mnfg').css('left', i * 20).appendTo(graf).get(0));

                $c('div').addClass('mnlb').css('left', i * 20).text(MONTHS[i]).appendTo(labs);
            }

            return new CallView(root, text, graf, $(mons));
        };

        CallView.prototype.scrollTo = function () {
            this.root.get(0).scrollIntoView();
        };

        CallView.prototype.reset = function () {
            var showing = this.showing, timer = this.timer;

            if (showing) {
                attr(showing.elemA, 'class', 'node');
                this.showing = null;
            }

            if (timer >= 0) {
                clearTimeout(timer);
                this.timer = -1;
            }
        };

        CallView.prototype.showOn = function (rv) {
            this.reset();
            var root = this.root, text = this.text, elem = rv.elemA, mons = this.mons;

            root.show();

            var elemRect = elem.getBoundingClientRect(), rootRect = root.get(0).getBoundingClientRect(), city = rv.region.City || 'MIDDLE OF NOWHERE', total = rv.region.Total, gutter = 20;

            // compute where the left should be, then limit it to the sides of the screen.
            var al = elemRect.left + elemRect.width / 2 - rootRect.width / 2 + document.body.scrollLeft, rl = Math.max(gutter, Math.min(window.innerWidth + document.documentElement.scrollLeft - rootRect.width - gutter, al));

            // adjust the pointer by the distance we were unable to travel.
            Transform($('.nib>div', root), al - rl, 45);

            attr(elem, 'class', 'node sel');
            root.css('left', rl).css('top', elemRect.top + $(document).scrollTop() - rootRect.height - 10);
            text.text(city).append($c('span').text(total + ' days/yr'));
            rv.region.Months.forEach(function (v, i) {
                $(mons.get(i)).css('height', 50 * (v / 255));
            });
            this.showing = rv;
        };

        CallView.prototype.hide = function (now) {
            var _this = this;
            this.reset();

            if (now) {
                this.showing = null;
                this.root.hide();
                return;
            }

            this.timer = setTimeout(function () {
                _this.hide(true);
            }, 500);
        };
        return CallView;
    })();

    var Search = (function () {
        function Search(model, n) {
            var _this = this;
            this.model = model;
            this.didFind = new Q.Signal;
            this.didRefine = new Q.Signal;
            this.didClear = new Q.Signal;
            this.wantsToSearch = new Q.Signal;
            this.didChangeState = new Q.Signal;
            this.active = false;
            this.selected = -1;
            var sugs = [], zips = [], city = [], root = $('#zips'), text = $('input', root).prop('disabled', true), list = $c('ol').hide().append($c('div').addClass('nib').append($c('div'))).appendTo(root);

            n = n || 10;
            for (var i = 0; i < n; i++) {
                var sug = $c('li');
                (function (i) {
                    sug.on('mousedown', function (e) {
                        e.preventDefault();
                    }).on('click', function (e) {
                        _this.commit(i);
                    });
                })(i);

                zips.push($c('span').addClass('zip').appendTo(sug));

                city.push($c('span').addClass('city').appendTo(sug));

                sugs.push(sug.appendTo(list));
            }

            model.zipsDidLoad.tap(function (model) {
                text.prop('disabled', false);
            });

            text.on('keydown', function (e) {
                var n = _this.sugs.length;
                switch (e.keyCode) {
                    case 40:
                        _this.select(Math.min(n - 1, Math.max(0, _this.selected + 1)));
                        break;
                    case 38:
                        _this.select(Math.min(n - 1, Math.max(0, _this.selected - 1)));
                        break;
                    case 27:
                        _this.clear();

                        // Firefox: escape will propagate and end up restoring the field to
                        // it's previous value.
                        e.stopPropagation();
                        e.preventDefault();
                        break;
                    case 13:
                        if (_this.selected != -1) {
                            _this.commit(_this.selected);
                        }
                        break;
                }
            }).on('keypress', function (e) {
                var cc = e.charCode;

                // firefox dispatches with bullshit charCodes when the key is not
                // printable.
                if (cc == 0 || e.ctrlKey || e.metaKey) {
                    return;
                }

                // first line defense against entering non-digits, this prevents
                // the non-digits from showing up at all. The more general catch
                // is in update where non-digits are replaced.
                if (cc < 48 || cc > 57) {
                    e.preventDefault();
                }
            }).on('keyup', function (e) {
                _this.update();
            }).on('change', function (e) {
                console.log('change');
                _this.update();
            }).on('paste', function (e) {
                setTimeout(function () {
                    _this.update();
                }, 0);
            }).on('click', function (e) {
                _this.update();
            }).on('focus', function () {
                var val = text.val();

                // reactivate if there is text in the search box.
                if (val.length > 0) {
                    _this.activate(true);
                    if (val.length < 5) {
                        _this.show();
                    }
                    _this.update(true);
                }
            }).on('blur', function () {
                var val = text.val();
                _this.hide();
                if (val.length < 5) {
                    _this.activate(false);
                }
            }).on('mouseover', function (e) {
                if (!_this.active) {
                    _this.wantsToSearch.raise();
                }
            });

            this.root = root;
            this.text = text;
            this.list = list;
            this.sugs = $(sugs);
            this.zips = $(zips);
            this.city = $(city);
        }
        Search.prototype.clear = function () {
            this.select(-1);
            this.text.val('').removeClass('error');
            this.update();
        };

        Search.prototype.activate = function (active) {
            if (this.active == active) {
                return;
            }

            this.active = active;
            if (active) {
                this.text.addClass('active');
            } else {
                this.text.removeClass('active');
            }

            this.didChangeState.raise(this.active);
        };

        Search.prototype.hide = function () {
            this.list.hide();
        };

        Search.prototype.show = function () {
            this.list.show();
        };

        Search.prototype.reset = function () {
            var sel = this.selected, sugs = this.sugs;
            if (sel != -1) {
                sugs.get(sel).removeClass('sel');
            }
            this.selected = -1;
            this.hide();
        };

        Search.prototype.commit = function (index) {
            this.text.val(this.sugs.get(index).attr('data-zip'));
            this.update();
        };

        Search.prototype.select = function (index) {
            var n = this.sugs.length, selected = this.selected, sugs = this.sugs;
            if (selected >= 0) {
                sugs.get(selected).removeClass('sel');
            }

            this.selected = index;
            if (index == -1) {
                return;
            }

            sugs.get(index).addClass('sel');
        };

        Search.prototype.update = function (force) {
            var _this = this;
            var model = this.model, text = this.text.val(), sugs = this.sugs, zips = this.zips, city = this.city, list = this.list, n = sugs.length;

            // remove any non-digits that got added
            var clean = text.replace(/\D/g, '');
            if (text != clean) {
                this.text.val(clean);
                return;
            }

            if (!force && this.current == text) {
                return;
            }
            this.current = text;

            // search is active if there is any text.
            this.activate(text.length > 0);

            if (!text || text.length == 0) {
                this.reset();
                this.didClear.raise();
                return;
            } else if (text.length == 5) {
                this.reset();
                this.model.findZipCoords(text, function (i, j, ok) {
                    if (!ok) {
                        // TODO(knorton): I may not need this.
                        console.log('not found', text);
                        return;
                    }
                    _this.didFind.raise(text, i, j);
                });
                return;
            }

            model.suggestZipsFor(text, function (vals, coords) {
                if (!vals) {
                    _this.hide();
                    _this.text.addClass('error');
                    return;
                }

                _this.text.removeClass('error');

                // TODO(knorton): move the selection if it points at a hidden item.
                _this.show();
                for (var i = 0; i < n; i++) {
                    var val = vals[i];
                    if (!val) {
                        sugs.get(i).hide();
                    } else {
                        sugs.get(i).attr('data-zip', val[0]).show();
                        zips.get(i).text(val[0]);
                        city.get(i).text(val[1]);
                    }
                }

                _this.didRefine.raise(text, vals.map(function (v) {
                    return { code: v[0], i: v[2], j: v[3] };
                }), coords);
            });
        };
        return Search;
    })();

    var View = (function () {
        function View(model) {
            var _this = this;
            this.model = model;
            this.regsByIdx = [];
            this.regsByCoord = [];
            this.root = $('#root');
            this.call = CallView.build();
            model.gridDidLoad.tap(function (model) {
                _this.build();
            });

            var search = this.search = new Search(model);

            search.didFind.tap(function (zip, i, j) {
                var grid = _this.model.grid, regs = _this.regsByCoord;
                _this.highlight([]);
                _this.call.showOn(regs[j * grid.W + i]);
            });
            search.didRefine.tap(function (zip, res, coords) {
                _this.call.hide(true);
                _this.highlight(coords);
            });
            search.didClear.tap(function () {
                _this.call.hide(true);
                _this.highlight([]);
            });
            search.wantsToSearch.tap(function () {
                _this.call.hide(true);
            });
            search.didChangeState.tap(function (active) {
                _this.highlight([]);
            });

            $(document.body).on('keydown', function (e) {
                if (e.keyCode == 27) {
                    _this.call.hide(true);
                    _this.search.clear();
                }
            });

            $(window).on('resize', function (e) {
                _this.rebuild();
            });
        }
        View.prototype.regionWasHovered = function (rv, over) {
            var call = this.call;

            // disable the hover if the search is active
            if (this.search.active) {
                return;
            }

            // hide on mouseout
            if (!over) {
                call.hide();
                return;
            }

            // show on mouseover
            call.showOn(rv);
        };

        View.prototype.highlight = function (coords) {
            var root = this.root, regs = this.regsByCoord, highlighted = this.highlighted, w = this.model.grid.W;

            if (highlighted) {
                highlighted.attr('class', 'node');
            }

            if (!coords.length) {
                root.attr('class', '');
                return;
            }

            root.attr('class', 'search');
            highlighted = $(coords.map(function (pt) {
                return regs[pt[1] * w + pt[0]].elemA;
            }));

            this.highlighted = highlighted.attr('class', 'node hi');
        };

        // TODO(knorton): Make this work for mobile cases.
        View.prototype.regionWasClicked = function (rv) {
        };

        View.prototype.show = function (i, j) {
            this.search.clear();
            var rv = this.regsByCoord[j * this.model.grid.W + i];
            if (rv) {
                this.regionWasHovered(rv, true);
            }
        };

        View.prototype.hide = function () {
            this.regionWasHovered(null, false);
        };

        View.prototype.rebuild = function () {
            this.root.text('');
            this.regsByIdx = [];
            this.regsByCoord = [];

            // TODO(knorton): Resize will lose all the highlighted.
            this.highlighted = null;
            this.build();
        };

        View.prototype.build = function () {
            var _this = this;
            var grid = this.model.grid, root = this.root, cont = root.parent(), w = Math.max(900, window.innerWidth - 120), dx = w / grid.W, h = dx * grid.Regions.reduce(function (m, r) {
                return Math.max(m, r.J + 1);
            }, 0), pad = 1;

            root.attr('width', w).attr('height', h).css('margin-left', (cont.get(0).offsetWidth - w) / 2);

            grid.Regions.forEach(function (region) {
                var v = region.Total >> 5, r = dx / 2, days = ((region.Total / 255) * 356) | 0, x = dx * region.I, y = dx * region.J, rv = new RegView(region), onClicked = function (e) {
                    _this.regionWasClicked(rv);
                }, onMouseOver = function (e) {
                    _this.regionWasHovered(rv, true);
                }, onMouseOut = function (e) {
                    _this.regionWasHovered(rv, false);
                };

                _this.regsByIdx.push(rv);
                _this.regsByCoord[region.J * grid.W + region.I] = rv;

                var bg = document.createElementNS(SVGNS, 'rect');
                attr(bg, 'x', x);
                attr(bg, 'y', y);
                attr(bg, 'width', 2 * r);
                attr(bg, 'height', 2 * r);
                attr(bg, 'fill', '#fff');
                attr(bg, 'stroke', 'none');
                on(bg, 'click', onClicked);
                on(bg, 'mouseover', onMouseOver);
                on(bg, 'mouseout', onMouseOut);
                root.get(0).appendChild(bg);

                var ea = document.createElementNS(SVGNS, 'circle');
                attr(ea, 'class', 'node');
                attr(ea, 'cx', x + r);
                attr(ea, 'cy', y + r);
                attr(ea, 'r', r - pad);
                root.get(0).appendChild(ea);
                rv.elemA = ea;

                if (v == 7) {
                    return;
                }

                var eb = document.createElementNS(SVGNS, 'circle');
                attr(eb, 'cx', x + r);
                attr(eb, 'cy', y + r);
                attr(eb, 'r', 0.9 * (r - pad) * (1 - (v / 7)));
                attr(eb, 'fill', '#fff');
                attr(eb, 'stroke', 'none');
                root.get(0).appendChild(eb);
                rv.elemB = eb;
            });
        };
        return View;
    })();

    var model = new Model, view = new View(model);

    var mapName = '55,75,45,85.json';
    model.load(mapName);

    var Show = function (e, scroll) {
    };

    $('.regions>li').hover(function (e) {
        var data = $(this).attr('data');
        if (!data) {
            return;
        }
        var pts = data.split(',');
        view.show(parseInt(pts[0]), parseInt(pts[1]));
    }, function (e) {
        view.hide();
    });

    // Tangle
    $(document).ready(function () {
        var element = document.getElementById("definition");

        var tangle = new Tangle(element, {
            initialize: function () {
                this.avgMin = 55;
                this.avgMax = 75;
                this.min = 45;
                this.max = 85;
            },
            update: function () {
                this.info = [this.avgMin, this.avgMax, this.min, this.max].join();
                model.debouncedLoadGrid(this.info + ".json");
            }
        });
    });
})(app || (app = {}));
