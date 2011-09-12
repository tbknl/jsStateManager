/**
 * State class.
 * @param name Name of the state.
 * @param[optional] context Context object, optionally containing the functions 'enter' and 'exit'.
 */
var State = function(name, context) {
    // -------- Private vars --------
    this._substates = {};
    this._name = name;
    this._context = context;

    /// @brief Invoke the enter callback function of this state.
    this.enter = context && typeof context.enter === 'function' ?
        this._callContextEnterFunc :
        this._dummyFunc;

    /// @brief Invoke the exit callback function of this state.
    this.exit = context && typeof context.exit === 'function' ?
        this._callContextExitFunc :
        this._dummyFunc;

    /*
    this.dbg = function(d) {
        for (var i in this._substates) {
            var prf = '>>>';
            for (var r = 0; r < d; ++r) prf += '    ';
            print(prf + this._substates[i].getName());
            this._substates[i].dbg(d+1);
        }
    };
    // */
};



/// @brief Add a substate to this state.
/// @param substate The state object to add as a substate.
State.prototype.addSubstate = function(substate) {
    var substateName = substate._name;
    if (substateName in this._substates) {
        throw 'SubstateAlreadyExists';
    }
    else {
        this._substates[substateName] = substate;
    }
};


/// @brief Return the name of this state.
/// @return The name of this state.
State.prototype.getName = function() {
    return this._name;
};


/// @brief Get a substate of this state.
/// @param name Name of the substate to get.
/// @return The requested substate.
State.prototype.getSubstate = function(name) {
    if (name in this._substates) {
        return this._substates[name];
    }
    else {
        throw 'UnknownSubstate';
    }
};


/// @brief Get the default substate of this state.
/// @return The default substate.
State.prototype.getDefaultSubstate = function() {
    name = this._context && this._context.defaultSubstate;
    if (name && name in this._substates) {
        return this._substates[name];
    }
    else return null;
};


/// @brief Call the enter function of the state context.
State.prototype._callContextEnterFunc = function() {
    this._context.enter(this._name);
};


/// @brief Call the exit function of the state context.
State.prototype._callContextExitFunc = function() {
    this._context.exit(this._name);
};


/// @brief Dummy function.
State.prototype._dummyFunc = function() {};


/**
 * StateManager class.
 */
var StateManager = function() {
    // -------- Private vars --------
    var _worldState = new State('__WORLD__');
    var _currentStateDescr = [];

    // -------- Private methods --------

    /// @brief Convert a state string to a state description.
    /// @param stateStr String with state and substates, separated by dots (e.g. 'state.substate.subsubstate'):
    /// @return State description: Array of state and substates (e.g. ['state', 'substate', 'subsubstate']).
    var stateDescrFromStateStr = function(stateStr) {
        if (stateStr === '') return [];
        return stateStr.split('.');
    };

    /// @brief Compute from which level up the state is changed when going to the described state.
    /// @param newStateDescr State description (array of state, substate strings).
    /// @return The change level (e.g.: from 'a.b' to 'a.c.d' changeLevel = 1).
    var computeChangeLevel = function(newStateDescr) {
        var changeLevel = 0;
        while (changeLevel < newStateDescr.length && changeLevel < _currentStateDescr.length && newStateDescr[changeLevel] == _currentStateDescr[changeLevel]) ++changeLevel;
        return changeLevel;
    };
    
    // -------- Public methods --------

    /// @brief Register a new state or substate.
    /// @param stateStr State string (e.g. 'state.substate').
    /// @param[optional] context Context object, optionally containing the functions 'enter' and 'exit'.
    this.registerState = function(stateStr, context) {
        var stateDescr = stateDescrFromStateStr(stateStr);
        var stateDepth = stateDescr.length;
        var parentState = _worldState;
        for (var i = 0; i < stateDepth - 1; ++i) {
            parentState = parentState.getSubstate(stateDescr[i]);
        }
        parentState.addSubstate(new State(stateDescr[stateDepth - 1], context));
    };
    
    /// @brief Change the current state.
    /// @param newStateStr State string of the state to change to (e.g. 'state.substate').
    /// @param[optional] forceAll Force all exit and enter callbacks to be called.
    this.changeState = function(newStateStr, forceAll) {
        var newStateDescr = stateDescrFromStateStr(newStateStr);

        // Determine change level:
        var changeLevel = computeChangeLevel(newStateDescr);

        // Call exit functions:
        var state = _worldState;
        var exitStates = [];
        for (var i = 0; i < _currentStateDescr.length; ++i) {
            state = state.getSubstate(_currentStateDescr[i]);
            if (i >= changeLevel || forceAll) {
                exitStates.push(state);
            }
        }
        while (exitStates.length > 0) {
            exitStates.pop().exit();
        }
        
        // Call enter functions:
        state = _worldState;
        for (var i = 0; i < newStateDescr.length; ++i) {
            state = state.getSubstate(newStateDescr[i]);
            if (i >= changeLevel || forceAll) {
                state.enter();
            }
        }
        
        // Make new state the current state:
        _currentStateDescr = newStateDescr;

        // Enter default substates:
        while (true) {
            state = state.getDefaultSubstate();
            if (state) {
                state.enter();
                _currentStateDescr.push(state.getName());
            }
            else break;
        }
    };

    /// @brief Return the current state.
    /// @return The current state.
    this.currentState = function() { return _currentStateDescr.join('.'); };

    /*
    this.dbg = function() { _worldState.dbg(0); }
    // */
};


// TEST (TODO: Remove)
var enFn = function(name) { print('Entering ' + name); };
var exFn = function(name) { print('Exiting ' + name); };

var m = new StateManager();

m.registerState('a1', { msg: null, enter: function(name) { msg = 'Bla!'; enFn(name); }, exit: function(name) { exFn(name + ' -- ' + msg)} });
m.registerState('a1.b', { enter: enFn, exit: exFn, defaultSubstate: 'c2' });
m.registerState('a2');
m.registerState('a1.b.c1', { abc: 'dummy' });
m.registerState('a1.b.c2', { enter: enFn, exit: exFn });

//m.dbg();

m.changeState('a1');
m.changeState('a1.b');
m.changeState('a2');
m.changeState('a1.b.c1');
m.changeState('a1.b.c2');
m.changeState('');

