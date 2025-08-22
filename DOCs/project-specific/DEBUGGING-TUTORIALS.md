# P2 Debugging Tutorials

## Table of Contents
1. [Tutorial 1: Basic Single-Stepping](#tutorial-1-basic-single-stepping)
2. [Tutorial 2: Setting and Managing Breakpoints](#tutorial-2-setting-and-managing-breakpoints)  
3. [Tutorial 3: Memory Inspection and Modification](#tutorial-3-memory-inspection-and-modification)
4. [Tutorial 4: Multi-COG Debugging](#tutorial-4-multi-cog-debugging)
5. [Tutorial 5: Debugging I2C Communication](#tutorial-5-debugging-i2c-communication)
6. [Tutorial 6: Analyzing PWM Signals](#tutorial-6-analyzing-pwm-signals)
7. [Tutorial 7: Debugging UART Communication](#tutorial-7-debugging-uart-communication)
8. [Tutorial 8: Performance Profiling](#tutorial-8-performance-profiling)

---

## Tutorial 1: Basic Single-Stepping

Learn how to step through P2 code line by line to understand program flow.

### Objective
Debug a simple LED blink program by single-stepping through the code.

### P2 Program
```spin2
PUB main() | i
  dira[56] := 1                ' Set P56 as output (LED)
  
  repeat
    outa[56] := 1              ' LED on
    waitms(500)
    outa[56] := 0              ' LED off  
    waitms(500)
    i++
```

### Steps

1. **Load and Start Program**
   - Connect P2 board
   - Load the program
   - The debugger will open automatically

2. **Set Initial Breakpoint**
   - In the disassembly view, find the `dira[56] := 1` instruction
   - Click on the line or press **F9** to set breakpoint
   - The line will show a red dot indicating the breakpoint

3. **Run to Breakpoint**
   - Press **Space** or click **GO** button
   - Execution stops at the breakpoint
   - The PC (Program Counter) arrow points to current instruction

4. **Single Step Through Code**
   - Press **S** to execute one instruction
   - Watch the PC advance to next instruction
   - Observe register changes in the COG register view
   - Note the DIRA register update when P56 is set as output

5. **Step Over Subroutine Calls**
   - When you reach `waitms(500)`, press **O** (step over)
   - This executes the entire waitms routine without stepping into it
   - Use **S** (step into) if you want to see inside waitms

6. **Monitor Variables**
   - Watch the `i` variable increment in the register view
   - Use the Register Watch panel to track specific values
   - Double-click a register to add it to the watch list

### Key Observations
- Instructions execute sequentially unless there's a jump
- Register values update immediately after instruction execution
- The heat map shows which memory locations are accessed
- Stack depth changes when calling/returning from subroutines

### Tips
- Use **U** (step out) to finish current subroutine
- Press **R** to reset the COG and start over
- The skip pattern indicator shows conditional execution

---

## Tutorial 2: Setting and Managing Breakpoints

Master different types of breakpoints for efficient debugging.

### Objective
Use various breakpoint types to catch specific program conditions.

### P2 Program
```spin2
PUB main() | value, count
  repeat
    value := read_sensor()
    
    if value > 100
      process_high(value)
    elseif value < 10  
      process_low(value)
    else
      process_normal(value)
      
    count++
    if count == 1000
      count := 0
      report_status()

PRI read_sensor() : result
  ' Simulate sensor reading
  result := getrnd() // 150
  
PRI process_high(val)
  debug(`term Status print "HIGH: ", dec(val), 13`)
  
PRI process_low(val)
  debug(`term Status print "LOW: ", dec(val), 13`)
  
PRI process_normal(val)
  debug(`term Status print "Normal: ", dec(val), 13`)
  
PRI report_status()
  debug(`term Status print "1000 samples processed", 13`)
```

### Steps

1. **Simple Breakpoint**
   - Set breakpoint at `if value > 100` line
   - Run program (**Space**)
   - Execution stops every time this line is reached
   - Press **Space** to continue each time

2. **Conditional Breakpoint**
   - Right-click on `process_high(value)` line
   - Select "Conditional Breakpoint"
   - Enter condition: `value > 120`
   - Now breaks only when value exceeds 120

3. **Count Breakpoint**
   - Right-click on `count++` line
   - Select "Hit Count Breakpoint"
   - Enter count: 100
   - Breaks on the 100th iteration

4. **Data Breakpoint (Watchpoint)**
   - In memory view, right-click on `count` variable location
   - Select "Break on Write"
   - Program breaks whenever count is modified

5. **Managing Multiple Breakpoints**
   - View all breakpoints in Breakpoints panel
   - Enable/disable individual breakpoints
   - **Shift+F9** clears all breakpoints
   - Export/import breakpoint sets for complex debugging

### Advanced Techniques

#### Breakpoint Groups
Create logical groups of breakpoints:
```
Group: Error Conditions
- Break at error handler
- Break on invalid sensor value
- Break on buffer overflow

Group: Performance
- Break at critical loops
- Break on timing violations
```

#### Temporary Breakpoints
- Hold **Ctrl** while clicking to set temporary breakpoint
- Automatically removed after first hit
- Useful for one-time checks

#### Log Breakpoints
- Right-click → "Log Message"
- Prints to debug terminal without stopping
- Good for tracing execution flow

### Tips
- Use conditional breakpoints to catch rare events
- Combine with register watches for complete picture
- Save breakpoint configurations for recurring debug sessions

---

## Tutorial 3: Memory Inspection and Modification

Learn to examine and modify P2 memory during debugging.

### Objective
Debug a data structure corruption issue by inspecting memory.

### P2 Program
```spin2
CON
  BUFFER_SIZE = 32
  
VAR
  long buffer[BUFFER_SIZE]
  long checksum
  byte status
  
PUB main() | i
  initialize_buffer()
  
  repeat
    fill_buffer()
    checksum := calculate_checksum()
    
    if verify_checksum()
      status := 1  ' OK
    else
      status := 0  ' Error
      debug(`term Error print "Checksum failed!", 13`)
      
PRI initialize_buffer() | i
  repeat i from 0 to BUFFER_SIZE-1
    buffer[i] := 0
    
PRI fill_buffer() | i
  repeat i from 0 to BUFFER_SIZE-1
    buffer[i] := getrnd()
    
PRI calculate_checksum() : sum | i
  sum := 0
  repeat i from 0 to BUFFER_SIZE-1
    sum += buffer[i]
    
PRI verify_checksum() : valid
  valid := (checksum == calculate_checksum())
```

### Steps

1. **Locate Variables in Memory**
   - Set breakpoint after `initialize_buffer()`
   - Run to breakpoint
   - In HUB memory view, find buffer array
   - Note the base address

2. **Monitor Memory Changes**
   - Right-click buffer address
   - Select "Add to Memory Watch"
   - Step through `fill_buffer()`
   - Watch values populate in real-time

3. **Use Heat Map**
   - Enable heat map visualization
   - Run program at full speed
   - Hot spots (red/yellow) show frequently accessed memory
   - Cold spots (blue) show rarely accessed areas

4. **Modify Memory Values**
   - Break after `fill_buffer()`
   - Double-click any buffer element
   - Enter new value (hex or decimal)
   - Press Enter to apply
   - Continue execution to see effect

5. **Track Corruption**
   - Set data breakpoint on suspicious location
   - Run until breakpoint triggers
   - Check call stack to find culprit
   - Examine surrounding code

### Memory Windows

#### COG Registers View
- Shows $000-$1FF (512 longs)
- Direct COG RAM access
- Special registers highlighted

#### LUT Memory View  
- Shows $200-$3FF (512 longs)
- Lookup table memory
- Shared between COGs

#### HUB Memory View
- Full 512KB HUB RAM
- Mini-map for navigation
- Search function (**Ctrl+F**)

### Advanced Features

#### Memory Patterns
Look for common corruption patterns:
- Buffer overrun: Data past array bounds
- Stack overflow: Stack area corrupted
- Uninitialized: Random/garbage values
- Double-free: Memory reused incorrectly

#### Memory Dump
- Right-click memory region
- Select "Dump to File"
- Choose format: Binary, Hex, or C Array
- Useful for offline analysis

#### Memory Fill
- Select memory range
- Right-click → "Fill"
- Enter pattern or value
- Useful for testing

### Tips
- Use memory bookmarks for quick navigation
- Color-code different data structures
- Compare memory snapshots to find changes
- Export suspicious regions for detailed analysis

---

## Tutorial 4: Multi-COG Debugging

Debug parallel execution across multiple P2 COGs.

### Objective
Debug a producer-consumer system using multiple COGs.

### P2 Program
```spin2
CON
  BUFFER_SIZE = 16
  
VAR
  long buffer[BUFFER_SIZE]
  long head, tail
  long producer_count, consumer_count
  
PUB main()
  head := 0
  tail := 0
  
  coginit(COGEXEC_NEW, @producer, @producer_count)
  coginit(COGEXEC_NEW, @consumer, @consumer_count)
  coginit(COGEXEC_NEW, @monitor, 0)
  
  repeat  ' Main COG continues
    waitms(1000)
    
PUB producer() | value
  repeat
    value := getrnd()
    
    repeat while ((head + 1) // BUFFER_SIZE) == tail
      ' Buffer full, wait
      
    buffer[head] := value
    head := (head + 1) // BUFFER_SIZE
    producer_count++
    
PUB consumer() | value
  repeat
    repeat while head == tail
      ' Buffer empty, wait
      
    value := buffer[tail]
    tail := (tail + 1) // BUFFER_SIZE
    consumer_count++
    process(value)
    
PRI process(val)
  ' Process data
  waitms(10)  ' Simulate work
  
PUB monitor()
  repeat
    debug(`term Stats clear`)
    debug(`term Stats print "Produced: ", dec(producer_count), 13`)
    debug(`term Stats print "Consumed: ", dec(consumer_count), 13`)
    debug(`term Stats print "Buffered: ", dec((head - tail) // BUFFER_SIZE), 13`)
    waitms(100)
```

### Steps

1. **Open Multiple Debuggers**
   - Start program
   - Break execution (**F6**)
   - Debugger windows open for each active COG
   - Windows cascade automatically

2. **Identify COGs**
   - COG 0: Main program
   - COG 1: Producer
   - COG 2: Consumer  
   - COG 3: Monitor
   - Each window shows COG ID in title

3. **Set Synchronized Breakpoints**
   - In COG 1 window: Set breakpoint at `buffer[head] := value`
   - In COG 2 window: Set breakpoint at `value := buffer[tail]`
   - Right-click breakpoints → "Synchronize Across COGs"

4. **Debug Race Condition**
   - Run all COGs (**Ctrl+F5**)
   - When any COG hits breakpoint, all COGs pause
   - Examine shared variables (head, tail, buffer)
   - Step through each COG individually

5. **Monitor Inter-COG Communication**
   - Watch shared memory locations
   - Use heat map to see access patterns
   - Identify contention points (hot spots)

### Multi-COG Controls

#### Global Controls
- **Ctrl+F5**: Run all COGs
- **Ctrl+F6**: Break all COGs
- **Ctrl+F7**: Step all COGs
- **Ctrl+F2**: Reset all COGs

#### Individual COG Control
- Click window to select COG
- Use standard debug keys for that COG
- Other COGs remain paused/running

#### COG Coordination Panel
- Shows all active COGs
- Status indicators (Running/Paused/Waiting)
- Quick jump between COG windows
- Synchronized breakpoint management

### Advanced Techniques

#### Lock Debugging
```spin2
PUB acquire_lock(id) | lock_value
  repeat
    lock_value := locktry(id)
  while lock_value == -1
  ' Got lock
```

Set breakpoints to track:
- Lock acquisition attempts
- Lock hold times
- Deadlock conditions

#### Message Passing Debug
```spin2
VAR
  long mailbox[8]  ' One per COG
  
PUB send_message(cog, msg)
  mailbox[cog] := msg
  
PUB get_message(cog) : msg
  msg := mailbox[cog]
  mailbox[cog] := 0
```

Monitor mailbox array for message flow.

### Tips
- Use color coding for different COGs
- Create window layouts for multi-COG debugging
- Record complex multi-COG scenarios for analysis
- Use synchronized stepping for lockstep debugging

---

## Tutorial 5: Debugging I2C Communication

Use the logic analyzer to debug I2C protocol issues.

### Objective
Debug communication with an I2C temperature sensor.

### P2 Program
```spin2
CON
  SCL_PIN = 10
  SDA_PIN = 11
  SENSOR_ADDR = $48
  
PUB main() | temp
  setup_i2c()
  
  repeat
    temp := read_temperature()
    debug(`term Temp print "Temperature: ", dec(temp), " C", 13`)
    debug(`logic I2C`, ubin(ina[SCL_PIN] << 1 | ina[SDA_PIN]))
    waitms(1000)
    
PRI setup_i2c()
  dira[SCL_PIN] := 0
  dira[SDA_PIN] := 0
  outa[SCL_PIN] := 0
  outa[SDA_PIN] := 0
  
PRI read_temperature() : temp | ack
  i2c_start()
  ack := i2c_write(SENSOR_ADDR << 1)      ' Write address
  if not ack
    debug(`term Error print "No ACK from sensor!", 13`)
    i2c_stop()
    return -1
    
  i2c_write($00)                           ' Temperature register
  i2c_start()                              ' Repeated start
  i2c_write((SENSOR_ADDR << 1) | 1)       ' Read address
  temp := i2c_read(1)                     ' Read with ACK
  temp := (temp << 8) | i2c_read(0)       ' Read with NAK
  i2c_stop()
  
  temp := temp >> 5                        ' Convert to Celsius
```

### Steps

1. **Setup Logic Analyzer**
   ```spin2
   debug(`logic I2C size 800 300 samples 8192 trigger %10`)
   ```
   - Channel 0: SDA
   - Channel 1: SCL
   - Trigger on SCL rising edge

2. **Capture I2C Transaction**
   - Run program
   - Logic analyzer triggers on START condition
   - Full I2C transaction captured

3. **Analyze Protocol**
   - START: SDA falls while SCL high
   - Address byte: 7 bits + R/W bit
   - ACK/NAK: 9th bit of each byte
   - Data bytes: 8 bits each
   - STOP: SDA rises while SCL high

4. **Identify Issues**

   **No ACK from Device:**
   - Check pull-up resistors (2.2kΩ - 10kΩ)
   - Verify device address
   - Check power to sensor
   - Measure rise time

   **Data Corruption:**
   - Clock stretching issues
   - Timing violations
   - Bus capacitance too high
   - Cross-talk between lines

5. **Measure Timing**
   - Click and drag to measure time
   - Verify clock frequency (100kHz/400kHz)
   - Check setup/hold times
   - Measure rise/fall times

### Protocol Decoder

Use the built-in I2C decoder:
1. Right-click logic analyzer
2. Select "Add Protocol Decoder"
3. Choose "I2C"
4. Assign SDA/SCL channels
5. View decoded messages

### Common I2C Issues

#### Address Problems
```
Expected: Write to 0x48
Actual:   Write to 0x90
Problem:  Address already shifted
Fix:      Use SENSOR_ADDR, not SENSOR_ADDR << 1
```

#### Missing Pull-ups
```
Symptom:  SDA/SCL stuck low
Logic:    All 0s, no transitions
Fix:      Add 4.7kΩ pull-ups
```

#### Clock Stretching
```
Symptom:  Slave holds SCL low
Logic:    Extended clock low periods
Fix:      Check for clock stretch support
```

### Tips
- Use protocol decoder for quick analysis
- Export captures for documentation
- Compare against known-good captures
- Create trigger patterns for specific errors

---

## Tutorial 6: Analyzing PWM Signals

Use the oscilloscope to debug PWM generation.

### Objective
Debug a servo control system using PWM analysis.

### P2 Program
```spin2
CON
  SERVO_PIN = 32
  PWM_PERIOD = 20_000   ' 20ms period (50Hz)
  
PUB main() | position
  setup_pwm()
  
  repeat
    ' Sweep servo from 0 to 180 degrees
    repeat position from 1000 to 2000 step 10
      set_servo(position)
      debug(`scope PWM`, sdec(ina[SERVO_PIN] * 100))
      waitms(20)
      
PRI setup_pwm()
  pinstart(SERVO_PIN, P_OE | P_PWM_TRIANGLE, 0, PWM_PERIOD)
  
PRI set_servo(pulse_width)
  ' pulse_width: 1000-2000 microseconds
  wypin(SERVO_PIN, pulse_width * (clkfreq / 1_000_000))
```

### Steps

1. **Setup Oscilloscope**
   ```spin2
   debug(`scope PWM size 600 400 samples 2000 range 0 110`)
   ```
   - Sample rate to capture full period
   - Trigger on rising edge
   - Time base: 5ms/div

2. **Measure PWM Parameters**
   - **Period**: Time between rising edges
   - **Pulse Width**: High time
   - **Duty Cycle**: (Pulse Width / Period) × 100%
   - **Frequency**: 1 / Period

3. **Verify Servo Timing**
   - Neutral (90°): 1.5ms pulse
   - Full CW (180°): 2.0ms pulse  
   - Full CCW (0°): 1.0ms pulse
   - Period: 20ms (50Hz)

4. **Debug Common Issues**

   **Servo Jitter:**
   - Measure pulse width stability
   - Check for timing variations
   - Look for noise on signal

   **Wrong Position:**
   - Verify pulse width calculation
   - Check clock frequency
   - Measure actual vs expected

   **No Movement:**
   - Verify signal reaches servo
   - Check power supply
   - Measure current draw

5. **Advanced Analysis**
   - Use persistence to see all positions
   - Trigger on specific pulse width
   - Measure rise/fall times
   - Check for overshoot/undershoot

### Scope Measurements

#### Automatic Measurements
- Right-click → "Add Measurement"
- Frequency, Period, Duty Cycle
- Rise Time, Fall Time
- Average, RMS, Peak-to-Peak

#### Cursor Measurements
- Enable cursors (**C** key)
- Measure time differences
- Measure voltage levels
- Calculate frequency manually

### PWM Variations

#### Variable Frequency PWM
```spin2
PRI set_pwm_frequency(freq) | period
  period := clkfreq / freq
  pinstart(PWM_PIN, P_OE | P_PWM_TRIANGLE, 0, period)
```

#### Phase-Correct PWM
```spin2
PRI setup_phase_correct()
  pinstart(PWM_PIN, P_OE | P_PWM_TRIANGLE | P_SYNC, 0, period)
```

### Tips
- Use math functions for calculated channels
- Record sweep for playback analysis
- Compare against reference waveform
- Export data for spreadsheet analysis

---

## Tutorial 7: Debugging UART Communication

Debug serial communication issues using multiple tools.

### Objective
Fix data corruption in UART communication.

### P2 Program
```spin2
CON
  TX_PIN = 62
  RX_PIN = 63
  BAUD_RATE = 115200
  
VAR
  byte rx_buffer[256]
  long rx_head, rx_tail
  
PUB main() | char
  setup_uart()
  
  repeat
    if char := rx_check()
      process_command(char)
      debug(`term UART print "Received: ", hex(char, 2), " '", char(char), "'", 13`)
      debug(`logic UART`, ubin(ina[RX_PIN] << 1 | ina[TX_PIN]))
      
PRI setup_uart()
  pinstart(TX_PIN, P_ASYNC_TX | P_OE, BAUD_RATE, clkfreq)
  pinstart(RX_PIN, P_ASYNC_RX, BAUD_RATE, clkfreq)
  
PRI tx_char(char)
  wypin(TX_PIN, char)
  repeat while not pinr(TX_PIN)
  
PRI rx_check() : char | rx_data
  rx_data := pinr(RX_PIN)
  if rx_data
    char := rx_data & $FF
    return char
  return 0
  
PRI process_command(cmd)
  case cmd
    "A".."Z": 
      tx_char(cmd + 32)  ' Echo lowercase
    "0".."9":
      tx_char(cmd)       ' Echo digit
    13:
      tx_char(13)       ' Echo newline
      tx_char(10)
    other:
      tx_char("?")      ' Unknown
```

### Steps

1. **Monitor with Terminal**
   ```spin2
   debug(`term UART size 80 25 title "UART Monitor"`)
   ```
   - Shows received/transmitted characters
   - Check for garbage characters
   - Verify command responses

2. **Analyze with Logic Analyzer**
   ```spin2
   debug(`logic UART size 800 200 samples 8192`)
   ```
   - Channel 0: TX
   - Channel 1: RX
   - Decode UART protocol

3. **Check Signal Quality**
   ```spin2
   debug(`scope UART_Signal size 600 400`)
   ```
   - Measure bit timing
   - Check voltage levels
   - Look for noise/distortion

4. **Debug Issues**

   **Garbage Characters:**
   ```
   Expected: "Hello"
   Received: "H�l��"
   ```
   - Check baud rate match
   - Verify bit timing
   - Check ground connection

   **Missing Characters:**
   ```
   Sent:     "ABCDEFGH"
   Received: "ACEFH"
   ```
   - Buffer overflow
   - Too slow processing
   - Flow control needed

   **Wrong Baud Rate:**
   Calculate actual baud:
   ```
   Measured bit time: 8.7µs
   Actual baud: 1 / 8.7µs = 114,942
   Error: (115200 - 114942) / 115200 = 0.22%
   ```

5. **Protocol Analysis**
   - Start bit (0)
   - 8 data bits (LSB first)
   - Optional parity bit
   - Stop bit(s) (1)
   - Idle state (1)

### UART Decoder

Enable UART decoder in logic analyzer:
1. Right-click → "Add Decoder"
2. Select "UART/Serial"
3. Configure:
   - Baud rate
   - Data bits (7/8)
   - Parity (None/Even/Odd)
   - Stop bits (1/1.5/2)

### Advanced Debugging

#### Framing Errors
```spin2
PRI check_framing_error() : error
  error := pinr(RX_PIN) >> 31  ' Check error flag
  if error
    debug(`term Error print "Framing error!", 13`)
```

#### Break Detection
```spin2
PRI detect_break() : is_break
  if ina[RX_PIN] == 0
    waitms(1)  ' Wait longer than character time
    if ina[RX_PIN] == 0
      is_break := true
```

#### Auto-Baud Detection
```spin2
PRI auto_baud() | bit_time
  ' Wait for known character (e.g., 'U' = $55)
  repeat until ina[RX_PIN] == 0  ' Start bit
  bit_time := measure_bit_time()
  BAUD_RATE := clkfreq / bit_time
```

### Tips
- Use terminal echo to verify communication
- Compare against known-good device
- Check cable length and quality
- Monitor power supply during transmission

---

## Tutorial 8: Performance Profiling

Profile P2 code to identify performance bottlenecks.

### Objective
Optimize a signal processing routine using profiling.

### P2 Program
```spin2
CON
  SAMPLES = 1024
  
VAR
  long data[SAMPLES]
  long filtered[SAMPLES]
  long fft_result[SAMPLES]
  long cycle_counts[10]
  
PUB main() | i, start_cnt
  setup_profiling()
  
  repeat
    ' Profile data acquisition
    start_cnt := cnt
    acquire_data()
    cycle_counts[0] := cnt - start_cnt
    
    ' Profile filtering
    start_cnt := cnt
    apply_filter()
    cycle_counts[1] := cnt - start_cnt
    
    ' Profile FFT
    start_cnt := cnt
    compute_fft()
    cycle_counts[2] := cnt - start_cnt
    
    ' Profile display
    start_cnt := cnt
    display_results()
    cycle_counts[3] := cnt - start_cnt
    
    report_performance()
    
PRI acquire_data() | i
  repeat i from 0 to SAMPLES-1
    data[i] := read_adc()
    
PRI apply_filter() | i
  ' Simple moving average
  repeat i from 1 to SAMPLES-2
    filtered[i] := (data[i-1] + data[i] + data[i+1]) / 3
    
PRI compute_fft()
  ' FFT computation
  ' ... complex processing ...
  
PRI display_results() | i
  repeat i from 0 to 511
    debug(`fft Spectrum`, sdec(fft_result[i]))
    
PRI report_performance() | i, total
  total := 0
  debug(`term Profile clear`)
  debug(`term Profile print "Performance Profile:", 13, 13`)
  
  debug(`term Profile print "Acquire:  ", dec(cycle_counts[0]), " cycles (", dec(cycle_counts[0] / (clkfreq / 1000)), " ms)", 13`)
  debug(`term Profile print "Filter:   ", dec(cycle_counts[1]), " cycles (", dec(cycle_counts[1] / (clkfreq / 1000)), " ms)", 13`)
  debug(`term Profile print "FFT:      ", dec(cycle_counts[2]), " cycles (", dec(cycle_counts[2] / (clkfreq / 1000)), " ms)", 13`)
  debug(`term Profile print "Display:  ", dec(cycle_counts[3]), " cycles (", dec(cycle_counts[3] / (clkfreq / 1000)), " ms)", 13`)
  
  repeat i from 0 to 3
    total += cycle_counts[i]
  debug(`term Profile print 13, "Total:    ", dec(total), " cycles (", dec(total / (clkfreq / 1000)), " ms)", 13`)
  debug(`term Profile print "Frame rate: ", dec(clkfreq / total), " Hz", 13`)
```

### Steps

1. **Initial Profiling**
   - Run program
   - Note cycle counts for each section
   - Identify bottlenecks (highest counts)

2. **Create Visual Profile**
   ```spin2
   debug(`plot Profile size 500 300 cartesian`)
   debug(`plot Profile set 0 0`)
   debug(`plot Profile box`, sdec(cycle_counts[0]/1000), sdec(20))
   ' ... repeat for each section
   ```

3. **Profile with Heat Maps**
   - Enable debugger heat maps
   - Run at full speed
   - Hot spots indicate frequently executed code
   - Focus optimization on hot areas

4. **Optimization Strategies**

   **Loop Unrolling:**
   ```spin2
   ' Before
   repeat i from 0 to SAMPLES-1
     filtered[i] := process(data[i])
   
   ' After - unroll by 4
   repeat i from 0 to SAMPLES-1 step 4
     filtered[i] := process(data[i])
     filtered[i+1] := process(data[i+1])
     filtered[i+2] := process(data[i+2])
     filtered[i+3] := process(data[i+3])
   ```

   **Use COG RAM:**
   ```spin2
   ' Move critical data to COG RAM
   ORG 0
   critical_loop
     ' Fast COG code here
   ```

   **Parallel Processing:**
   ```spin2
   ' Split work across COGs
   coginit(COGEXEC_NEW, @process_half1, @data[0])
   coginit(COGEXEC_NEW, @process_half2, @data[512])
   ```

5. **Measure Improvements**
   - Re-run profiling after each change
   - Compare cycle counts
   - Calculate speedup percentage
   - Verify output still correct

### Profiling Tools

#### Cycle Counter
```spin2
PUB measure_cycles(code_ptr) : cycles | start
  start := cnt
  code_ptr()  ' Call function
  cycles := cnt - start
```

#### Instruction Counting
Use debugger to count instructions:
1. Set breakpoint at function start
2. Set breakpoint at function end
3. Note instruction count difference

#### Memory Access Profiling
```spin2
VAR
  long memory_accesses[1000]
  long access_index
  
PRI log_access(addr)
  memory_accesses[access_index++] := addr
  if access_index >= 1000
    analyze_access_pattern()
    access_index := 0
```

### Optimization Checklist

- [ ] Profile before optimizing
- [ ] Identify top 3 bottlenecks
- [ ] Optimize algorithmic complexity first
- [ ] Move critical code to COG RAM
- [ ] Use lookup tables for complex math
- [ ] Unroll critical loops
- [ ] Parallelize independent operations
- [ ] Use smart pins for I/O operations
- [ ] Cache frequently accessed data
- [ ] Verify correctness after each change

### Tips
- Always measure, don't guess
- Optimize algorithms before code
- Consider memory vs speed tradeoffs
- Document optimization decisions
- Keep unoptimized version for reference

---

## Summary

These tutorials cover essential P2 debugging techniques:

1. **Single-stepping** - Understanding program flow
2. **Breakpoints** - Catching specific conditions
3. **Memory inspection** - Finding data corruption
4. **Multi-COG** - Debugging parallel execution
5. **I2C** - Protocol analysis with logic analyzer
6. **PWM** - Signal analysis with oscilloscope
7. **UART** - Serial communication debugging
8. **Profiling** - Performance optimization

### Best Practices

1. **Start Simple**: Begin with basic techniques before advanced features
2. **Use Multiple Tools**: Combine debugger, logic analyzer, and scope
3. **Document Issues**: Record symptoms and solutions
4. **Save Sessions**: Use recording for complex debugging
5. **Share Knowledge**: Export and share debug sessions with team

### Next Steps

- Practice with your own P2 projects
- Explore advanced debugger features
- Create custom debug configurations
- Share debugging techniques with the community

For more resources:
- [P2 Documentation](https://www.parallax.com/propeller-2)
- [Debug Terminal GitHub](https://github.com/parallaxinc/pnut-term-ts)
- [Parallax Forums](https://forums.parallax.com)