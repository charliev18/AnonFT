
from flask import jsonify

STATUS_OK = 200
STATUS_ERR = 400

'''
Formatting for sending arrays over HTTP
'''
def wrap_str_array(arr):
    return '[' + arr + ']'


'''
Formatting for submitting arrays to C++ command line args
'''
def scrub_str_array(arr):
    str_arr = str(arr).replace('[', '')
    str_arr = str_arr.replace(' ', '')
    str_arr = str_arr.replace("'", '')
    return str_arr.replace(']', '')


'''
Parses printed values from FiatShamir library setup phase
'''
def parse_setup_out(code, output):
    N_DELIM = ' is '
    ARRAY_DELIM = ' are :'
    EOL = ', \n'

    if (code != 0):
        return output, STATUS_ERR

    n = output.split(N_DELIM)[1].split(' ')[0]
    ws = wrap_str_array(output.split(ARRAY_DELIM)[1].split(EOL)[0])
    ids = wrap_str_array(output.split(ARRAY_DELIM)[2].split(EOL)[0])
    return jsonify({'public': {'n': n, 'identifiers': ids}, 'private': {'witnesses': ws}}), STATUS_OK


'''
Parses printed values from FiatShamir library prover first phase
'''
def parse_prove_a_out(code, output):
    DELIM = ' : '
    EOL = '\n'

    if (code != 0):
        return output, STATUS_ERR

    r = output.split(DELIM)[1].split(EOL)[0]
    x = output.split(DELIM)[2].split(EOL)[0]
    return jsonify({'public': {'x': x}, 'private': {'r': r}}), STATUS_OK


'''
Parses printed values from FiatShamir library prover second phase
'''
def parse_prove_b_out(code, output):
    DELIM = ' : '
    EOL = '\n'

    if (code != 0):
        return output, STATUS_ERR

    y = output.split(DELIM)[1].split(EOL)[0]
    return jsonify({'public': {'y': y}}), STATUS_OK


'''
Parses printed values from FiatShamir library verifier first phase
'''
def parse_verif_a_out(code, output):
    DELIM = ' :'

    if (code != 0):
        return output, STATUS_ERR

    challenge = wrap_str_array(output.split(DELIM)[1][:-3])
    return jsonify({'public': {'challenge': challenge}}), STATUS_OK


'''
Parses printed values from FiatShamir library verifier second phase
'''
def parse_verif_b_out(code, output):
    DELIM = ' : '
    EOL = '\n'
    ACCEPTING = 'accepts'

    if (code != 0):
        return output, STATUS_ERR

    x = output.split(DELIM)[1].split(EOL)[0]
    accepts = ACCEPTING in output
    return jsonify({'public': {'x': x, 'accepts': accepts}}), STATUS_OK
