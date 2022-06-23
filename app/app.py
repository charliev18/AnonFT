
import json
from flask import Flask, request, render_template
import subprocess
from utils import *


'''
Initial Flask server setup
'''
app = Flask(__name__,
            static_url_path='', 
            static_folder='static',
            template_folder='templates')


'''
Endpoint for example verification page
'''
@app.route("/verifierAuth")
def verifierAuth():
    return render_template('verifier.html')


'''
Endpoint for example prover authentication page
'''
@app.route("/proverAuth")
def proverAuth():
    return render_template('prover.html')


'''
App home endpoint
'''
@app.route("/")
def hello_world():
    return render_template('index.html')


'''
Endpoint to send setup parameters to, 
Returns setup n,k,I,w values
'''
@app.route("/setup", methods=['POST'])
def setup():
    print("RECEIVED SETUP REQUEST")
    data = request.json
    print("Running Fiat Shamir setup with: " + str(data))

    output = subprocess.run(["./prove", "-s", 
                             "-p", data['p'], 
                             "-q", data['q'], 
                             "-k", data['k']], 
                             capture_output=True, text=True)
    return parse_setup_out(output.returncode, output.stdout)


''' 
Endpoint to send prover first action parameters to, 
Returns prover x,r values
'''
@app.route("/prove1", methods=['POST'])
def prove1():
    print("RECEIVED PROVE STEP 1 REQUEST")
    data = request.json
    print("Running Fiat Shamir prover step 1 with: " + str(data))

    output = subprocess.run(["./prove", "-x", 
                             "-n", str(data['n']), 
                             "-k", str(data['k']), 
                             "-w", scrub_str_array(data['witnesses'])], 
                             capture_output=True, text=True)
    return parse_prove_a_out(output.returncode, output.stdout)


'''
Endpoint to send prover second action parameters to,
Returns prover y value
'''
@app.route("/prove2", methods=['POST'])
def prove2():
    print("RECEIVED PROVE STEP 2 REQUEST")
    data = request.json
    print("Running Fiat Shamir prover step 2 with: " + str(data))

    output = subprocess.run(["./prove", "-y", 
                             "-n", str(data['n']), 
                             "-k", str(data['k']), 
                             "-r", str(data['r']), 
                             "-w", scrub_str_array(data['witnesses']), 
                             "-c", scrub_str_array(data['challenge'])],
                             capture_output=True, text=True)
    return parse_prove_b_out(output.returncode, output.stdout)


'''
Endpoint to send verifier first action parameters to,
Returns verifier challenge, c value
'''
@app.route("/verify1", methods=['POST'])
def verify1():
    print("RECEIVED VERIFY STEP 1 REQUEST")
    data = request.json
    print("Running Fiat Shamir verifier step 1 with: " + str(data))

    output = subprocess.run(["./verify", "-c", 
                             "-k", str(data['k'])],
                             capture_output=True, text=True)
    return parse_verif_a_out(output.returncode, output.stdout)


'''
Endpoint to send verifier second action parameters to,
Returns true if proof valid, false otherwise
'''
@app.route("/verify2", methods=['POST'])
def verify2():
    print("RECEIVED VERIFY STEP 2 REQUEST")
    data = request.json
    print("Running Fiat Shamir verifier step 2 with: " + str(data))

    output = subprocess.run(["./verify", "-v", 
                             "-n", str(data['n']), 
                             "-k", str(data['k']),
                             "-x", str(data['x']), 
                             "-y", str(data['y']), 
                             "-p", scrub_str_array(data['identifiers']), 
                             "-b", scrub_str_array(data['challenge'])],
                             capture_output=True, text=True)
    return parse_verif_b_out(output.returncode, output.stdout)
    

'''
Endpoint to update tornado cache entries
'''
@app.route("/tornadoCache", methods=['POST'])
def tornadoCache():
    print("RECEIVED CACHE UPDATE REQUEST")
    data = request.json

    with open("./static/" + data['fname'], "r+") as f:
        cached = json.load(f)
        cached.extend(data['to_update'])
        f.seek(0)
        f.truncate()
        json.dump(cached, f)
    return json.dumps({'success':True}), 200, {'ContentType':'application/json'}


if __name__ == "__main__":
    app.run(debug=True)
