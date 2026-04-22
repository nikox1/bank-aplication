package pl.nikodem.bankapp.activities;

import android.os.Bundle;
import android.os.CountDownTimer;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import pl.nikodem.bankapp.R;
import pl.nikodem.bankapp.api.RetrofitClient;
import pl.nikodem.bankapp.models.BlikCode;
import pl.nikodem.bankapp.utils.SharedPrefManager;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class BlikActivity extends AppCompatActivity {

    private TextView tvBlikCode, tvTimer, tvTimerLabel;
    private Button btnGenerate;
    private ProgressBar progressBar;
    private CountDownTimer countDownTimer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_blik);

        initViews();
        setupListeners();
        generateBlikCode();
    }

    private void initViews() {
        tvBlikCode = findViewById(R.id.tvBlikCode);
        tvTimer = findViewById(R.id.tvTimer);
        tvTimerLabel = findViewById(R.id.tvTimerLabel);
        btnGenerate = findViewById(R.id.btnGenerate);
        progressBar = findViewById(R.id.progressBar);
    }

    private void setupListeners() {
        btnGenerate.setOnClickListener(v -> generateBlikCode());

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
    }

    private void generateBlikCode() {
        btnGenerate.setEnabled(false);
        progressBar.setVisibility(View.VISIBLE);

        String token = "Bearer " + SharedPrefManager.getInstance(this).getToken();

        RetrofitClient.getInstance().getApiService()
                .generateBlik(token)
                .enqueue(new Callback<BlikCode>() {
                    @Override
                    public void onResponse(Call<BlikCode> call, Response<BlikCode> response) {
                        btnGenerate.setEnabled(true);
                        progressBar.setVisibility(View.GONE);

                        if (response.isSuccessful() && response.body() != null) {
                            BlikCode blikCode = response.body();
                            displayBlikCode(blikCode);
                        } else {
                            Toast.makeText(BlikActivity.this,
                                    "Failed to generate BLIK code",
                                    Toast.LENGTH_SHORT).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<BlikCode> call, Throwable t) {
                        btnGenerate.setEnabled(true);
                        progressBar.setVisibility(View.GONE);
                        Toast.makeText(BlikActivity.this,
                                "Connection error: " + t.getMessage(),
                                Toast.LENGTH_SHORT).show();
                    }
                });
    }

    private void displayBlikCode(BlikCode blikCode) {
        String code = blikCode.getCode();
        String formattedCode = code.substring(0, 3) + " " + code.substring(3);
        tvBlikCode.setText(formattedCode);

        if (countDownTimer != null) {
            countDownTimer.cancel();
        }

        tvTimerLabel.setVisibility(View.VISIBLE);
        tvTimer.setVisibility(View.VISIBLE);

        countDownTimer = new CountDownTimer(blikCode.getRemainingSeconds() * 1000L, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                int seconds = (int) (millisUntilFinished / 1000);
                int mins = seconds / 60;
                int secs = seconds % 60;
                tvTimer.setText(String.format("%d:%02d", mins, secs));
            }

            @Override
            public void onFinish() {
                tvBlikCode.setText("-- ---");
                tvTimerLabel.setVisibility(View.GONE);
                tvTimer.setVisibility(View.GONE);
                Toast.makeText(BlikActivity.this, "BLIK code expired", Toast.LENGTH_SHORT).show();
            }
        }.start();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (countDownTimer != null) {
            countDownTimer.cancel();
        }
    }
}
