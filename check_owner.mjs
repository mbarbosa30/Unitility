import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL),
});

const SIMPLE_ACCOUNT = '0xe7C0dad97500ccD89fF9361DC5acB20013873bb0';
const EXPECTED_OWNER = '0x216844eF94D95279c6d1631875F2dd93FbBdfB61';

async function checkOwner() {
  try {
    const owner = await publicClient.readContract({
      address: SIMPLE_ACCOUNT,
      abi: [{
        name: 'owner',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
      }],
      functionName: 'owner',
    });
    
    console.log('SimpleAccount:', SIMPLE_ACCOUNT);
    console.log('Actual owner:', owner);
    console.log('Expected owner (connected wallet):', EXPECTED_OWNER);
    console.log('Match:', owner.toLowerCase() === EXPECTED_OWNER.toLowerCase());
    
    if (owner.toLowerCase() !== EXPECTED_OWNER.toLowerCase()) {
      console.log('\n❌ OWNER MISMATCH! This is why signature validation fails (AA23).');
      console.log('The SimpleAccount is owned by a different address than the one signing the UserOp.');
    } else {
      console.log('\n✅ Owner matches - signature validation should work.');
    }
  } catch (error) {
    console.error('Failed to check owner:', error);
  }
}

checkOwner();
